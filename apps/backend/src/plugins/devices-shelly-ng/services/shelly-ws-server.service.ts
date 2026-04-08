import { Server as HttpServer, IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { parse as parseUrl } from 'url';
import WebSocket, { WebSocketServer } from 'ws';

import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { AppInstanceHolder } from '../../../common/services/app-instance-holder.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DelegatesManagerService } from '../delegates/delegates-manager.service';
import { DEVICES_SHELLY_NG_PLUGIN_NAME, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';

const WS_PATH = '/api/v1/plugins/shelly-ng/ws';

interface ShellyRpcFrame {
	src?: string;
	method?: string;
	params?: Record<string, unknown>;
	id?: number;
}

@Injectable()
export class ShellyWsServerService implements OnModuleDestroy {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'ShellyWsServerService',
	);

	private wss: WebSocketServer | null = null;
	private httpServer: HttpServer | null = null;
	private upgradeHandler: ((req: IncomingMessage, socket: Duplex, head: Buffer) => void) | null = null;
	private readonly wsToDeviceId: Map<WebSocket, string> = new Map();
	private stopped = false;

	constructor(
		private readonly appInstanceHolder: AppInstanceHolder,
		private readonly delegatesManager: DelegatesManagerService,
		private readonly devicesService: DevicesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
	) {}

	/**
	 * Start the inbound WebSocket server for sleeping Shelly devices.
	 * Sleeping devices (H&T, Motion, Door/Window) connect to this endpoint
	 * when they wake up to deliver status updates.
	 */
	start(): void {
		if (this.wss) {
			return;
		}

		this.stopped = false;

		this.wss = new WebSocketServer({ noServer: true });

		this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
			const ip = req.socket.remoteAddress ?? 'unknown';

			this.logger.log(`Sleeping device connected from ${ip}`);

			ws.on('message', (data: Buffer) => {
				this.handleMessage(ws, data, ip);
			});

			ws.on('close', () => {
				const closedDeviceId = this.wsToDeviceId.get(ws);

				this.wsToDeviceId.delete(ws);

				// Don't mark as sleeping if the server is shutting down —
				// doStop() sets all devices to UNKNOWN after closing clients.
				if (this.stopped) {
					return;
				}

				if (closedDeviceId) {
					this.logger.debug(`Sleeping device=${closedDeviceId} from ${ip} disconnected, marking as sleeping`);
					this.markDeviceSleeping(closedDeviceId);
				} else {
					this.logger.debug(`Sleeping device from ${ip} disconnected`);
				}
			});

			ws.on('error', (err: Error) => {
				this.logger.warn(`WebSocket error from ${ip}: ${err.message}`);
			});
		});

		// Attach to the HTTP server's upgrade event
		try {
			const app = this.appInstanceHolder.getApp();
			const httpAdapter = app.getHttpAdapter();
			const server = httpAdapter.getHttpServer() as HttpServer;

			this.httpServer = server;

			this.upgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
				const pathname = parseUrl(req.url ?? '').pathname;

				if (pathname === WS_PATH) {
					this.wss?.handleUpgrade(req, socket, head, (ws) => {
						this.wss?.emit('connection', ws, req);
					});
				}
				// Don't close the socket for non-matching paths — other upgrade
				// handlers (socket.io) need to process them.
			};

			server.on('upgrade', this.upgradeHandler);

			this.logger.log(`Inbound WebSocket server listening on ${WS_PATH}`);
		} catch (err) {
			this.logger.warn(`Failed to start inbound WS server: ${(err as Error).message}`);

			if (this.wss) {
				this.wss.close();
				this.wss = null;
			}
		}
	}

	stop(): void {
		this.stopped = true;
		this.wsToDeviceId.clear();

		if (this.wss) {
			// Close all connected clients
			for (const client of this.wss.clients) {
				client.close(1000, 'Server shutting down');
			}

			this.wss.close();
			this.wss = null;
		}

		if (this.upgradeHandler && this.httpServer) {
			this.httpServer.off('upgrade', this.upgradeHandler);
			this.upgradeHandler = null;
			this.httpServer = null;
		}
	}

	onModuleDestroy(): void {
		this.stop();
	}

	private handleMessage(ws: WebSocket, data: Buffer, ip: string): void {
		if (this.stopped) {
			return;
		}

		let frame: ShellyRpcFrame;

		try {
			frame = JSON.parse(data.toString()) as ShellyRpcFrame;
		} catch {
			this.logger.warn(`Invalid JSON from sleeping device at ${ip}`);

			return;
		}

		const deviceId = frame.src;

		if (!deviceId) {
			this.logger.debug(`Received frame without src from ${ip}`);

			return;
		}

		// Track which device is on this WebSocket for sleeping state on close
		if (!this.wsToDeviceId.has(ws)) {
			this.wsToDeviceId.set(ws, deviceId);
		}

		// Acknowledge the frame if it has an id (JSON-RPC request).
		// Per Shelly Gen2 RPC protocol, a valid response needs result or error.
		if (typeof frame.id === 'number') {
			const ack = JSON.stringify({ id: frame.id, src: 'fb-smart-panel', dst: deviceId, result: null });

			ws.send(ack);
		}

		if (frame.method === 'NotifyStatus' || frame.method === 'NotifyFullStatus') {
			this.handleStatusNotification(deviceId, frame.params ?? {}, ip);
		} else if (frame.method === 'NotifyEvent') {
			this.logger.debug(`Event from sleeping device=${deviceId}: ${JSON.stringify(frame.params)}`);
		}
	}

	private handleStatusNotification(deviceId: string, params: Record<string, unknown>, ip: string): void {
		this.logger.log(`Status update from sleeping device=${deviceId} at ${ip}`);

		const delegate = this.delegatesManager.get(deviceId);

		if (delegate) {
			// Route status values through the delegate's change pipeline.
			// Flatten nested objects to dot-notation keys so handlers like
			// "battery.percent" receive the leaf value, not the parent object.
			for (const [key, values] of Object.entries(params)) {
				if (key === 'ts' || typeof values !== 'object' || values === null) {
					continue;
				}

				this.emitFlattened(delegate, key, values as Record<string, unknown>);
			}

			// Briefly mark device as connected during wake
			this.markDeviceAwake(deviceId);
		} else {
			this.logger.debug(`No delegate for sleeping device=${deviceId}, skipping status update`);
		}
	}

	/**
	 * Emit values with dot-notation keys for nested objects.
	 * e.g., { battery: { percent: 95 } } emits both "battery" (the object)
	 * and "battery.percent" (the leaf value), matching how the library's
	 * component change handlers register keys like "battery.percent".
	 */
	private emitFlattened(
		delegate: { emit: (event: string, ...args: unknown[]) => boolean },
		compKey: string,
		values: Record<string, unknown>,
		prefix: string = '',
	): void {
		for (const [attr, val] of Object.entries(values)) {
			const fullKey = prefix ? `${prefix}.${attr}` : attr;

			delegate.emit('value', compKey, fullKey, val);

			if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
				this.emitFlattened(delegate, compKey, val as Record<string, unknown>, fullKey);
			}
		}
	}

	private markDeviceAwake(shellyId: string): void {
		void this.setDeviceState(shellyId, ConnectionState.CONNECTED, 'awake');
	}

	private markDeviceSleeping(shellyId: string): void {
		void this.setDeviceState(shellyId, ConnectionState.SLEEPING, 'sleeping');
	}

	private setDeviceState(shellyId: string, state: ConnectionState, label: string): void {
		void this.devicesService
			.findOneBy<ShellyNgDeviceEntity>('identifier', shellyId, DEVICES_SHELLY_NG_TYPE)
			.then((device) => {
				if (!device) return;

				return this.deviceConnectivityService.setConnectionState(device.id, { state });
			})
			.catch((err: Error) => {
				this.logger.warn(`Failed to mark sleeping device=${shellyId} as ${label}: ${err.message}`);
			});
	}
}
