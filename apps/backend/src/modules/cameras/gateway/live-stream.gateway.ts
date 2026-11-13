import { Server as HttpServer, IncomingMessage, STATUS_CODES } from 'http';
import { Duplex } from 'stream';
import WebSocket, { WebSocketServer } from 'ws';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EventType as ConfigEventType } from '../../config/config.constants';
import { ConfigService } from '../../config/services/config.service';
import { EventType as DevicesEventType } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { EventType as DisplaysEventType } from '../../displays/displays.constants';
import { EventType as UsersEventType } from '../../users/users.constants';
import { CAMERAS_LIVE_PATH, CAMERAS_MODULE_NAME } from '../cameras.constants';
import { CameraUpstreamException, errorName } from '../cameras.exceptions';
import { CameraSessionOwner } from '../cameras.utils';
import { CamerasConfigModel } from '../models/config.model';
import { ICameraStreamProvider } from '../platforms/camera-stream.provider';
import { CameraSessionService, CameraStreamSession } from '../services/camera-session.service';
import { CamerasService } from '../services/cameras.service';
import { Go2rtcStreamLease, Go2rtcStreamsService } from '../services/go2rtc-streams.service';
import { Go2rtcRelayStatus, Go2rtcService } from '../services/go2rtc.service';

import { LiveStreamConnection } from './live-stream-connection';
import {
	LIVE_CLIENT_MAX_PAYLOAD_BYTES,
	LIVE_CLOSE,
	LIVE_UPSTREAM_ACQUIRE_TIMEOUT_MS,
	LiveCloseKind,
} from './live-stream.constants';

type RefusalReason = 'invalid_session' | 'module_disabled' | 'config_unavailable';

interface LiveEntry {
	/** Relay generation the socket was admitted under; a different one means go2rtc lost the stream. */
	readonly generation: number;
	device: DeviceEntity | null;
	provider: ICameraStreamProvider | null;
}

/**
 * Serves `CAMERAS_LIVE_PATH`: takes the raw HTTP `upgrade`, admits a camera session and proxies it to go2rtc through
 * one `LiveStreamConnection` per socket.
 *
 * Everything up to and including the 101 runs synchronously in the `upgrade` event: engine.io (socket.io) ends every
 * upgrade on another path that has not written a byte after one second, so the session is checked from memory and
 * upstream work starts only after the handshake. Invalid sessions are refused at HTTP level and never upgraded.
 *
 * The request url carries the session token: it never reaches a log line, a close reason or an error. Log lines carry
 * ids and fixed reason codes only.
 */
@Injectable()
export class LiveStreamGateway implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = createExtensionLogger(CAMERAS_MODULE_NAME, 'LiveStreamGateway');

	private readonly entries = new Map<LiveStreamConnection, LiveEntry>();

	private wss: WebSocketServer | null = null;
	private server: HttpServer | null = null;
	private unsubscribe: (() => void) | null = null;
	private readonly upgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer): void =>
		this.onUpgrade(req, socket, head);

	constructor(
		private readonly httpAdapterHost: HttpAdapterHost,
		private readonly configService: ConfigService,
		private readonly sessions: CameraSessionService,
		private readonly cameras: CamerasService,
		private readonly go2rtc: Go2rtcService,
		private readonly streams: Go2rtcStreamsService,
	) {}

	onApplicationBootstrap(): void {
		// Absent in a CLI context: there is no HTTP server to serve live sockets on.
		const server = this.httpAdapterHost.httpAdapter?.getHttpServer() as HttpServer | undefined;

		if (!server || this.wss) {
			return;
		}

		this.wss = new WebSocketServer({
			noServer: true,
			maxPayload: LIVE_CLIENT_MAX_PAYLOAD_BYTES,
			perMessageDeflate: false,
		});
		this.server = server;
		this.unsubscribe = this.go2rtc.subscribe((status) => this.onRelayStatus(status));

		server.on('upgrade', this.upgradeHandler);
	}

	onModuleDestroy(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;

		this.server?.off('upgrade', this.upgradeHandler);
		this.server = null;

		this.closeWhere(() => true, 'SERVER_SHUTDOWN');

		this.wss?.close();
		this.wss = null;
	}

	getActiveCount(): number {
		return this.entries.size;
	}

	@OnEvent(DevicesEventType.DEVICE_DELETED)
	handleDeviceDeleted(payload: { id: string }): void {
		this.closeWhere((session) => session.deviceId === payload.id, 'REVOKED');
	}

	@OnEvent(DisplaysEventType.DISPLAY_DELETED)
	handleDisplayDeleted(payload: { id: string }): void {
		this.closeOwner({ kind: 'display', id: payload.id });
	}

	@OnEvent(DisplaysEventType.DISPLAY_TOKEN_REVOKED)
	handleDisplayTokenRevoked(payload: { id: string }): void {
		this.closeOwner({ kind: 'display', id: payload.id });
	}

	@OnEvent(UsersEventType.USER_DELETED)
	handleUserDeleted(payload: { id: string }): void {
		this.closeOwner({ kind: 'user', id: payload.id });
	}

	@OnEvent(ConfigEventType.CONFIG_UPDATED)
	async handleConfigUpdated(payload?: { source: string; type: 'plugin' | 'module' | 'section' }): Promise<void> {
		if (this.entries.size === 0) {
			return;
		}

		if (!payload || (payload.type === 'module' && payload.source === CAMERAS_MODULE_NAME)) {
			if (this.readConfig() === null) {
				this.closeWhere(() => true, 'MODULE_DISABLED');
			}

			return;
		}

		if (payload.type === 'plugin') {
			await this.revalidate();
		}
	}

	private onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
		const url = req.url ?? '';
		const queryStart = url.indexOf('?');
		const pathname = queryStart === -1 ? url : url.slice(0, queryStart);

		// Other paths belong to other listeners (socket.io, the Shelly inbound server): leave the socket untouched.
		if (pathname !== CAMERAS_LIVE_PATH || !this.wss) {
			return;
		}

		try {
			this.handleLiveUpgrade(req, socket, head, queryStart === -1 ? '' : url.slice(queryStart + 1));
		} catch (error) {
			this.logger.warn(`Live stream upgrade failed error=${errorName(error)}`);

			socket.destroy();
		}
	}

	/** Synchronous up to and including `handleUpgrade`, which writes the 101 and calls back in the same tick. */
	private handleLiveUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, query: string): void {
		const wss = this.wss;

		if (!wss) {
			return;
		}

		let config: CamerasConfigModel;

		try {
			config = this.configService.getModuleConfig<CamerasConfigModel>(CAMERAS_MODULE_NAME);
		} catch {
			this.refuseUpgrade(socket, 503, 'config_unavailable');

			return;
		}

		if (!config.enabled) {
			this.refuseUpgrade(socket, 404, 'module_disabled');

			return;
		}

		const session = this.sessions.consume(new URLSearchParams(query).get('session') ?? '');

		if (!session) {
			this.refuseUpgrade(socket, 401, 'invalid_session');

			return;
		}

		wss.handleUpgrade(req, socket, head, (client) => this.admit(client, session, config));
	}

	private refuseUpgrade(socket: Duplex, status: 401 | 404 | 503, reason: RefusalReason): void {
		this.logger.warn(`Live stream refused reason=${reason}`);

		// The HTTP server removed its own error handler before emitting `upgrade`.
		socket.on('error', () => undefined);

		if (!socket.writable) {
			socket.destroy();

			return;
		}

		socket.once('finish', () => socket.destroy());
		socket.end(`HTTP/1.1 ${status} ${STATUS_CODES[status]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
	}

	private admit(client: WebSocket, session: CameraStreamSession, config: CamerasConfigModel): void {
		const refusal = this.admissionRefusal(session, config);

		if (refusal) {
			const [code, reason] = LIVE_CLOSE[refusal];

			this.logger.warn(`Live stream refused reason=${reason} session=${session.id} device=${session.deviceId}`);

			// No connection owns this socket: a frame error must not become an unhandled `error` event.
			client.on('error', () => undefined);
			client.close(code, reason);

			return;
		}

		const entry: LiveEntry = { generation: this.go2rtc.getStatus().generation, device: null, provider: null };
		const connection = new LiveStreamConnection({
			client,
			session,
			connectUpstream: (signal) => this.connectUpstream(session, entry, signal),
			onClosed: (closed) => {
				this.entries.delete(closed);
			},
		});

		this.entries.set(connection, entry);

		this.logger.log(`Live stream opened session=${session.id} device=${session.deviceId} profile=${session.profileId}`);

		connection.start();
	}

	private admissionRefusal(session: CameraStreamSession, config: CamerasConfigModel): LiveCloseKind | null {
		if (!this.go2rtc.isRunning()) {
			return 'RELAY_UNAVAILABLE';
		}

		if (this.entries.size >= config.maxSessions) {
			return 'SESSION_LIMIT';
		}

		let perCamera = 0;

		for (const connection of this.entries.keys()) {
			if (connection.session.deviceId === session.deviceId) {
				perCamera++;
			}
		}

		if (perCamera >= Math.min(config.maxSessionsPerCamera, config.maxSessions)) {
			return 'CAMERA_SESSION_LIMIT';
		}

		return null;
	}

	/**
	 * Camera lookup and lease, bounded in time. `signal` aborts when the connection closes (client gone, revoked, relay
	 * lost): the lookup result is then dropped without a lease being acquired, and a lease that completes after the abort
	 * is released at once. A lease that arrives after the deadline is released here too.
	 */
	private async connectUpstream(
		session: CameraStreamSession,
		entry: LiveEntry,
		signal: AbortSignal,
	): Promise<Go2rtcStreamLease> {
		const attempt = (async () => {
			throwIfClosed(signal);

			const { device, provider } = await this.cameras.getProviderOrThrow(session.deviceId);

			// Never acquire for a connection that is already gone.
			throwIfClosed(signal);

			entry.device = device;
			entry.provider = provider;

			const lease = await this.streams.acquire(device, provider, session.profileId);

			if (signal.aborted) {
				lease.release();
				throwIfClosed(signal);
			}

			return lease;
		})();

		let timer: NodeJS.Timeout | undefined;
		let onAbort: (() => void) | undefined;

		try {
			return await Promise.race([
				attempt,
				new Promise<never>((_, reject) => {
					timer = setTimeout(
						() => reject(new CameraUpstreamException('Live stream could not be started')),
						LIVE_UPSTREAM_ACQUIRE_TIMEOUT_MS,
					);
					timer.unref();

					onAbort = () => reject(closedError());
					signal.addEventListener('abort', onAbort, { once: true });
				}),
			]);
		} catch (error) {
			void attempt.then(
				(lease) => lease.release(),
				() => undefined,
			);

			throw error;
		} finally {
			clearTimeout(timer);

			if (onAbort) {
				signal.removeEventListener('abort', onAbort);
			}
		}
	}

	private onRelayStatus(status: Go2rtcRelayStatus): void {
		this.closeWhere(
			(_session, entry) => status.state !== 'running' || status.generation !== entry.generation,
			'RELAY_UNAVAILABLE',
		);
	}

	/**
	 * Re-checks every watched camera profile after a plugin config change: a disabled provider plugin throws
	 * `CameraOfflineException`, a profile switched off is no longer available. One check per (device, profile), all in
	 * parallel.
	 */
	private async revalidate(): Promise<void> {
		const targets = new Map<string, { deviceId: string; profileId: string }>();

		for (const connection of this.entries.keys()) {
			const { deviceId, profileId } = connection.session;

			targets.set(JSON.stringify([deviceId, profileId]), { deviceId, profileId });
		}

		await Promise.all(
			[...targets.values()].map(async ({ deviceId, profileId }) => {
				try {
					const { device, provider } = await this.cameras.getProviderOrThrow(deviceId);

					await this.cameras.resolveProfile(device, provider, profileId);
				} catch (error) {
					this.logger.warn(
						`Live stream camera unavailable device=${deviceId} profile=${profileId} error=${errorName(error)}`,
					);

					this.closeWhere((session) => session.deviceId === deviceId && session.profileId === profileId, 'REVOKED');
				}
			}),
		);
	}

	/** `null` when the module is disabled or its configuration cannot be read. */
	private readConfig(): CamerasConfigModel | null {
		try {
			const config = this.configService.getModuleConfig<CamerasConfigModel>(CAMERAS_MODULE_NAME);

			return config.enabled ? config : null;
		} catch (error) {
			this.logger.error(`Failed to load cameras configuration, closing live streams (${errorName(error)})`);

			return null;
		}
	}

	private closeOwner(owner: CameraSessionOwner): void {
		this.closeWhere((session) => session.owner.kind === owner.kind && session.owner.id === owner.id, 'REVOKED');
	}

	private closeWhere(
		predicate: (session: CameraStreamSession, entry: LiveEntry) => boolean,
		kind: LiveCloseKind,
	): void {
		// Closing removes the entry through `onClosed`, so iterate over a copy.
		for (const [connection, entry] of [...this.entries]) {
			if (predicate(connection.session, entry)) {
				connection.close(kind);
			}
		}
	}
}

function closedError(): Error {
	return new Error('Live stream connection closed');
}

function throwIfClosed(signal: AbortSignal): void {
	if (signal.aborted) {
		throw closedError();
	}
}
