import * as dgram from 'dgram';
import { existsSync } from 'fs';
import * as os from 'os';

import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { DEVICES_UNIFI_PROTECT_PLUGIN_NAME } from '../devices-unifi-protect.constants';

import { ProtectScanInterface, mapSocketErrorCode, selectScanInterfaces } from './protect-discovery-interfaces';
import { ProtectDiscoveryProbeService, ProtectProbeResult } from './protect-discovery-probe.service';
import { isProtectConsoleCandidate, parseDiscoveryReply, replyIdentityMac } from './protect-discovery-tlv';
import {
	PROTECT_DISCOVERY_ENVIRONMENT,
	PROTECT_DISCOVERY_MAX_ADDRESSES,
	PROTECT_DISCOVERY_MAX_CANDIDATES,
	PROTECT_DISCOVERY_MAX_OTHER_DEVICES,
	PROTECT_DISCOVERY_MULTICAST_ADDRESS,
	PROTECT_DISCOVERY_PORT,
	PROTECT_DISCOVERY_REQUEST_V1,
	PROTECT_DISCOVERY_REQUEST_V2,
	PROTECT_DISCOVERY_RESEND_ROUNDS,
	PROTECT_DISCOVERY_WINDOW_MS,
	PROTECT_PROBE_CONCURRENCY,
	PROTECT_PROBE_DEFAULT_PORT,
	ProtectDiscoveryFailureReason,
	ProtectDiscoveryStatus,
	ProtectDiscoveryWarning,
	ProtectInterfaceErrorCode,
	ProtectInterfaceStatus,
	ProtectProbeStatus,
} from './protect-discovery.constants';

/**
 * The `dgram.Socket` surface the scan uses. `bind`, `close` and `on` are narrowed (the real socket satisfies them) so a
 * test double does not have to be a full `dgram.Socket`.
 */
export interface ProtectDiscoverySocket extends Pick<
	dgram.Socket,
	'send' | 'setBroadcast' | 'setMulticastTTL' | 'setMulticastInterface' | 'setMulticastLoopback'
> {
	bind(port: number, address: string, callback?: () => void): unknown;
	close(callback?: () => void): unknown;
	on(event: string, listener: (...args: any[]) => void): unknown;
}

export interface ProtectDiscoveryEnvironment {
	/** A udp4 socket. */
	createSocket(): ProtectDiscoverySocket;
	networkInterfaces(): NodeJS.Dict<os.NetworkInterfaceInfo[]>;
	/** `existsSync('/.dockerenv')` */
	isContainer(): boolean;
}

export const createNodeDiscoveryEnvironment = (): ProtectDiscoveryEnvironment => ({
	createSocket: () => dgram.createSocket({ type: 'udp4', reuseAddr: false }),
	networkInterfaces: () => os.networkInterfaces(),
	isContainer: () => existsSync('/.dockerenv'),
});

export interface ProtectDiscoveryScanInterface {
	name: string;
	address: string;
	broadcastAddress: string;
	status: ProtectInterfaceStatus;
	errorCode: ProtectInterfaceErrorCode | null;
}

export interface ProtectDiscoveryScanConsole {
	mac: string;
	host: string;
	addresses: string[];
	hostname: string | null;
	model: string | null;
	firmware: string | null;
	directConnectDomain: string | null;
	uuid: string | null;
	probe: ProtectProbeResult;
}

export interface ProtectDiscoveryScan {
	status: ProtectDiscoveryStatus;
	failureReason: ProtectDiscoveryFailureReason | null;
	warnings: ProtectDiscoveryWarning[];
	startedAt: string | null;
	finishedAt: string | null;
	interfaces: ProtectDiscoveryScanInterface[];
	consoles: ProtectDiscoveryScanConsole[];
	otherUnifiDevices: number;
}

type Candidate = Omit<ProtectDiscoveryScanConsole, 'probe'>;

interface InterfaceState {
	iface: ProtectScanInterface;
	socket: ProtectDiscoverySocket;
	/** Bound and still able to send. */
	ready: boolean;
	closed: boolean;
	sentOk: boolean;
	errorCode: ProtectInterfaceErrorCode | null;
	/** Resolves once the bind attempt succeeded (`true`) or failed (`false`). */
	bound: Promise<boolean>;
}

const idleScan = (): ProtectDiscoveryScan => ({
	status: ProtectDiscoveryStatus.IDLE,
	failureReason: null,
	warnings: [],
	startedAt: null,
	finishedAt: null,
	interfaces: [],
	consoles: [],
	otherUnifiDevices: 0,
});

@Injectable()
export class ProtectDiscoveryService implements OnModuleDestroy {
	private readonly logger = createExtensionLogger(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, 'ProtectDiscoveryService');
	private last: ProtectDiscoveryScan = idleScan();
	private running: Promise<ProtectDiscoveryScan> | null = null;
	private readonly timers = new Set<NodeJS.Timeout>();
	private sockets: ProtectDiscoverySocket[] = [];
	/** Ends the current scan early (module shutdown). */
	private abort: (() => void) | null = null;
	private destroyed = false;

	constructor(
		@Inject(PROTECT_DISCOVERY_ENVIRONMENT) private readonly env: ProtectDiscoveryEnvironment,
		private readonly probeService: ProtectDiscoveryProbeService,
	) {}

	getLastScan(): ProtectDiscoveryScan {
		return this.last;
	}

	/** Concurrent calls share one scan. Never rejects. */
	scan(): Promise<ProtectDiscoveryScan> {
		if (this.running === null) {
			const run = this.run().finally(() => {
				if (this.running === run) {
					this.running = null;
				}
			});

			this.running = run;
		}

		return this.running;
	}

	onModuleDestroy(): void {
		this.destroyed = true;
		this.abort?.();
		this.releaseResources();
	}

	private async run(): Promise<ProtectDiscoveryScan> {
		const startedAt = new Date().toISOString();

		this.last = { ...idleScan(), status: ProtectDiscoveryStatus.SCANNING, startedAt };

		try {
			if (this.destroyed) {
				return this.finish({
					...this.last,
					status: ProtectDiscoveryStatus.FAILED,
					failureReason: ProtectDiscoveryFailureReason.ALL_INTERFACES_FAILED,
				});
			}

			return await this.execute(startedAt);
		} catch (error) {
			this.logger.warn(`Discovery scan failed unexpectedly: ${error instanceof Error ? error.name : 'unknown'}`);

			return this.finish({
				...this.last,
				status: ProtectDiscoveryStatus.FAILED,
				failureReason: ProtectDiscoveryFailureReason.ALL_INTERFACES_FAILED,
			});
		} finally {
			this.releaseResources();
			this.abort = null;
		}
	}

	private async execute(startedAt: string): Promise<ProtectDiscoveryScan> {
		const interfaces = selectScanInterfaces(this.env.networkInterfaces());

		if (interfaces.length === 0) {
			return this.finish({
				...this.last,
				status: ProtectDiscoveryStatus.FAILED,
				failureReason: ProtectDiscoveryFailureReason.NO_USABLE_INTERFACE,
			});
		}

		const candidates = new Map<string, Candidate>();
		const others = new Set<string>();
		const state = { collecting: true, candidateLimitReached: false };

		const aborted = new Promise<'aborted'>((resolve) => {
			this.abort = () => resolve('aborted');
		});
		const windowDone = new Promise<'window'>((resolve) => {
			this.schedule(() => resolve('window'), PROTECT_DISCOVERY_WINDOW_MS);
		});

		const states = interfaces.map((iface) =>
			this.openInterface(iface, (msg, source) => {
				if (state.collecting) {
					this.handleDatagram(msg, source, candidates, others, state);
				}
			}),
		);

		for (let round = 1; round < PROTECT_DISCOVERY_RESEND_ROUNDS; round++) {
			this.schedule(
				() => this.sendRound(states),
				Math.round((round * PROTECT_DISCOVERY_WINDOW_MS) / PROTECT_DISCOVERY_RESEND_ROUNDS),
			);
		}

		await Promise.race([Promise.all(states.map((s) => s.bound)), aborted]);

		if (!this.destroyed) {
			this.sendRound(states);
		}

		await Promise.race([windowDone, aborted]);

		state.collecting = false;
		this.releaseResources();

		const interfaceResults = states.map((s) => this.toInterfaceResult(s));
		const failedCount = interfaceResults.filter((i) => i.status === ProtectInterfaceStatus.ERROR).length;

		if (this.destroyed || failedCount === interfaceResults.length) {
			return this.finish({
				...this.last,
				status: ProtectDiscoveryStatus.FAILED,
				failureReason: ProtectDiscoveryFailureReason.ALL_INTERFACES_FAILED,
				interfaces: interfaceResults,
			});
		}

		const probed = await Promise.race([this.probeAll(Array.from(candidates.values())), aborted]);

		if (probed === 'aborted') {
			return this.finish({
				...this.last,
				status: ProtectDiscoveryStatus.FAILED,
				failureReason: ProtectDiscoveryFailureReason.ALL_INTERFACES_FAILED,
				interfaces: interfaceResults,
			});
		}

		const consoles: ProtectDiscoveryScanConsole[] = [];

		for (const entry of probed) {
			if (entry.probe.status === ProtectProbeStatus.NOT_CONSOLE) {
				others.add(entry.mac);
			} else {
				consoles.push(entry);
			}
		}

		const warnings: ProtectDiscoveryWarning[] = [];

		if (failedCount > 0) {
			warnings.push(ProtectDiscoveryWarning.SOME_INTERFACES_FAILED);
		}

		if (consoles.length === 0 && others.size === 0) {
			warnings.push(ProtectDiscoveryWarning.NO_REPLIES);

			if (this.env.isContainer()) {
				warnings.push(ProtectDiscoveryWarning.CONTAINER_NETWORK_ISOLATED);
			}
		}

		if (state.candidateLimitReached) {
			warnings.push(ProtectDiscoveryWarning.CANDIDATE_LIMIT_REACHED);
		}

		return this.finish({
			status: ProtectDiscoveryStatus.COMPLETED,
			failureReason: null,
			warnings,
			startedAt,
			interfaces: interfaceResults,
			consoles,
			otherUnifiDevices: others.size,
		});
	}

	private finish(scan: Omit<ProtectDiscoveryScan, 'finishedAt'>): ProtectDiscoveryScan {
		this.last = { ...scan, finishedAt: new Date().toISOString() };

		return this.last;
	}

	private schedule(callback: () => void, delayMs: number): void {
		const timer = setTimeout(() => {
			this.timers.delete(timer);
			callback();
		}, delayMs);

		this.timers.add(timer);
	}

	private releaseResources(): void {
		for (const timer of this.timers) {
			clearTimeout(timer);
		}

		this.timers.clear();

		const sockets = this.sockets;

		this.sockets = [];

		for (const socket of sockets) {
			this.closeSocket(socket);
		}
	}

	private closeSocket(socket: ProtectDiscoverySocket): void {
		try {
			socket.close();
		} catch {
			// already closed
		}
	}

	private openInterface(
		iface: ProtectScanInterface,
		onMessage: (msg: Buffer, source: dgram.RemoteInfo) => void,
	): InterfaceState {
		const socket = this.env.createSocket();
		let resolveBound: (ok: boolean) => void = () => undefined;
		const bound = new Promise<boolean>((resolve) => {
			resolveBound = resolve;
		});
		const entry: InterfaceState = {
			iface,
			socket,
			ready: false,
			closed: false,
			sentOk: false,
			errorCode: null,
			bound,
		};

		this.sockets.push(socket);

		socket.on('error', (error: unknown) => {
			entry.errorCode ??= mapSocketErrorCode(error);
			entry.ready = false;

			if (!entry.closed) {
				entry.closed = true;
				this.closeSocket(socket);
			}

			this.logger.debug(`Discovery socket failed: ${mapSocketErrorCode(error)}`);
			resolveBound(false);
		});
		socket.on('message', (msg: Buffer, source: dgram.RemoteInfo) => onMessage(msg, source));

		socket.bind(0, iface.address, () => {
			if (entry.closed) {
				return;
			}

			this.configureSocket(socket, iface.address);
			entry.ready = true;
			resolveBound(true);
		});

		return entry;
	}

	/** Each option on its own: a multicast setup failure must not stop the broadcast. */
	private configureSocket(socket: ProtectDiscoverySocket, address: string): void {
		const steps: Array<[string, () => unknown]> = [
			['setBroadcast', () => socket.setBroadcast(true)],
			['setMulticastTTL', () => socket.setMulticastTTL(1)],
			['setMulticastInterface', () => socket.setMulticastInterface(address)],
			['setMulticastLoopback', () => socket.setMulticastLoopback(false)],
		];

		for (const [name, step] of steps) {
			try {
				step();
			} catch {
				this.logger.debug(`Discovery socket option failed: ${name}`);
			}
		}
	}

	private sendRound(states: InterfaceState[]): void {
		for (const entry of states) {
			if (!entry.ready || entry.closed) {
				continue;
			}

			const destinations = [entry.iface.broadcast, PROTECT_DISCOVERY_MULTICAST_ADDRESS];

			for (const destination of destinations) {
				for (const request of [PROTECT_DISCOVERY_REQUEST_V1, PROTECT_DISCOVERY_REQUEST_V2]) {
					this.send(entry, request, destination);
				}
			}
		}
	}

	private send(entry: InterfaceState, request: Buffer, destination: string): void {
		const onError = (error: unknown): void => {
			entry.errorCode ??= mapSocketErrorCode(error);
			this.logger.debug(`Discovery send failed: ${mapSocketErrorCode(error)}`);
		};

		try {
			entry.socket.send(request, PROTECT_DISCOVERY_PORT, destination, (error) => {
				if (error) {
					onError(error);
				} else {
					entry.sentOk = true;
				}
			});
		} catch (error) {
			onError(error);
		}
	}

	private toInterfaceResult(entry: InterfaceState): ProtectDiscoveryScanInterface {
		const failed = !entry.sentOk;
		const fallbackFailure = entry.closed || !entry.ready;

		return {
			name: entry.iface.name,
			address: entry.iface.address,
			broadcastAddress: entry.iface.broadcast,
			status: failed || fallbackFailure ? ProtectInterfaceStatus.ERROR : ProtectInterfaceStatus.OK,
			errorCode: failed || fallbackFailure ? (entry.errorCode ?? ProtectInterfaceErrorCode.SOCKET_ERROR) : null,
		};
	}

	private handleDatagram(
		msg: Buffer,
		source: dgram.RemoteInfo,
		candidates: Map<string, Candidate>,
		others: Set<string>,
		state: { candidateLimitReached: boolean },
	): void {
		if (source.port !== PROTECT_DISCOVERY_PORT) {
			return;
		}

		const parsed = parseDiscoveryReply(msg);

		if ('reason' in parsed) {
			this.logger.debug(`Ignored discovery datagram: ${parsed.reason}`);

			return;
		}

		const reply = parsed.reply;
		const mac = replyIdentityMac(reply);

		if (mac === null) {
			return;
		}

		if (!isProtectConsoleCandidate(reply)) {
			if (!candidates.has(mac) && (others.has(mac) || others.size < PROTECT_DISCOVERY_MAX_OTHER_DEVICES)) {
				others.add(mac);
			}

			return;
		}

		const existing = candidates.get(mac);

		if (existing) {
			if (existing.addresses.length < PROTECT_DISCOVERY_MAX_ADDRESSES && !existing.addresses.includes(source.address)) {
				existing.addresses.push(source.address);
			}

			existing.hostname ??= reply.hostname;
			existing.model ??= reply.shortModel;
			existing.firmware ??= reply.firmware;
			existing.directConnectDomain ??= reply.directConnectDomain;
			existing.uuid ??= reply.uuid;

			return;
		}

		if (candidates.size >= PROTECT_DISCOVERY_MAX_CANDIDATES) {
			state.candidateLimitReached = true;

			return;
		}

		others.delete(mac);
		candidates.set(mac, {
			mac,
			host: source.address,
			addresses: [source.address],
			hostname: reply.hostname,
			model: reply.shortModel,
			firmware: reply.firmware,
			directConnectDomain: reply.directConnectDomain,
			uuid: reply.uuid,
		});
	}

	private async probeAll(candidates: Candidate[]): Promise<ProtectDiscoveryScanConsole[]> {
		const results = new Array<ProtectDiscoveryScanConsole>(candidates.length);
		let next = 0;

		const worker = async (): Promise<void> => {
			while (next < candidates.length && !this.destroyed) {
				const index = next++;
				const candidate = candidates[index];
				const probe = await this.probeService.probe({ host: candidate.host, port: PROTECT_PROBE_DEFAULT_PORT });

				results[index] = { ...candidate, probe };
			}
		};

		await Promise.all(Array.from({ length: Math.min(PROTECT_PROBE_CONCURRENCY, candidates.length) }, worker));

		return results.filter((entry) => entry !== undefined);
	}
}
