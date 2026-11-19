import { lookup } from 'dns/promises';
import * as net from 'net';
import { AddressInfo, isIP } from 'net';
import { Duplex, Transform, pipeline } from 'stream';

import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { GO2RTC_HTTP_TIMEOUT_MS, Go2rtcMode } from '../../../modules/cameras/cameras.constants';
import { Go2rtcRelayStatus, Go2rtcService } from '../../../modules/cameras/services/go2rtc.service';
import { EventType as ConfigEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { withExtraCa } from '../client/protect-https-agent';
import { connectVerifiedProtectTls } from '../client/protect-tls-connect';
import { ProtectTlsConnectPlan, planProtectTls } from '../client/protect-tls-policy';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	PROTECT_STREAM_AVAILABILITY_TTL_MS,
	PROTECT_STREAM_BRIDGE_HANDSHAKE_TIMEOUT_MS,
	PROTECT_STREAM_BRIDGE_HANDSHAKE_WINDOW_MS,
	PROTECT_STREAM_BRIDGE_IDLE_TIMEOUT_MS,
	PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS,
	PROTECT_STREAM_BRIDGE_MAX_HANDSHAKES,
	PROTECT_STREAM_BRIDGE_MAX_LISTENERS,
	PROTECT_TRUSTED_CA,
} from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory, toProtectApiError } from '../errors/protect-api.error';
import { ProtectConfigModel } from '../models/config.model';
import { isValidProtectHost } from '../validators/protect-config.validators';

import { ProtectConnectorService, ProtectStreamTlsTarget } from './protect-connector.service';
import { ProtectFailureLogLimiter } from './protect-failure-log-limiter';
import {
	ProtectRtspGuardError,
	ProtectRtspGuardFailure,
	ProtectRtspResponseGuard,
} from './protect-rtsp-response-guard';

/** Where go2rtc connects: the bridge listener, never the console. */
export interface ProtectBridgeEndpoint {
	host: string;
	port: number;
}

export type ProtectBridgeVerification = 'verified' | 'unverified' | 'unknown';

export interface ProtectBridgePrepareOptions {
	signal?: AbortSignal;
	/** What is left of the caller's source budget; every step of `prepare()` ends by then (`timeout`). */
	deadlineMs?: number;
}

type RefusalReason = 'limit' | 'rate' | 'peer' | 'session' | 'upstream' | 'tls' | 'timeout' | 'unreachable';
type CloseReason = ProtectRtspGuardFailure | 'idle' | 'ended' | 'error';

type RelayMode = Exclude<Go2rtcMode, 'disabled'>;

interface RelayRef {
	mode: RelayMode;
	generation: number;
}

interface BridgeRoute {
	/** Local address the listener binds; also the host go2rtc dials. */
	bindAddress: string;
	/** External relay on another host: the only peer addresses admitted (normalised). Null on loopback. */
	allowedPeers: ReadonlySet<string> | null;
}

interface BridgeListener {
	key: string;
	relay: RelayRef;
	route: BridgeRoute;
	/** The console port every connection of this listener goes to (R1: one listener per upstream port). */
	upstreamPort: number;
	server: net.Server;
	/** 0 until listening. */
	port: number;
	connections: Set<BridgeConnection>;
	/** True once a `prepare()` returned this port: go2rtc may hold it, so only the relay, disable and destroy close it. */
	handedOut: boolean;
	/** `prepare()` calls currently working with this listener. */
	claims: number;
	closed: boolean;
}

interface BridgeConnection {
	listener: BridgeListener;
	client: net.Socket;
	upstream: Duplex | null;
	guard: ProtectRtspResponseGuard | null;
	/** Upstream host read at accept time; the port is the listener's. */
	host: string;
	sessionGeneration: number;
	abort: AbortController;
	idleTimer: ReturnType<typeof setTimeout> | null;
	lastActivityAt: number;
	closed: boolean;
}

interface VerificationEntry {
	result: 'verified' | 'unverified';
	at: number;
}

const LOOPBACK_ROUTE: BridgeRoute = Object.freeze({ bindAddress: '127.0.0.1', allowedPeers: null });
/** Endpoints remembered per session; a console has a handful of stream ports, this only bounds a misbehaving caller. */
const MAX_VERIFICATION_ENTRIES = 64;

const TLS_FAILURES: ReadonlySet<ProtectErrorCategory> = new Set([
	ProtectErrorCategory.TLS_UNTRUSTED,
	ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH,
]);

const bridgeError = (category: ProtectErrorCategory): ProtectApiError => new ProtectApiError(category, 'tls');

const ignoreError = (): void => undefined;

/** `::ffff:192.0.2.1` and `192.0.2.1` are one peer; null for anything that is no IP address. */
const normalizeAddress = (address: string | undefined): string | null => {
	if (typeof address !== 'string' || isIP(address) === 0) {
		return null;
	}

	const lower = address.toLowerCase();
	const mapped = lower.startsWith('::ffff:') ? lower.slice('::ffff:'.length) : null;

	return mapped !== null && isIP(mapped) === 4 ? mapped : lower;
};

const isLoopbackHost = (host: string): boolean =>
	host === 'localhost' || host === '::1' || (isIP(host) === 4 && host.startsWith('127.'));

const isValidPort = (port: unknown): port is number =>
	typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535;

const verificationKey = (host: string, port: number): string => JSON.stringify([host.toLowerCase(), port]);

const closeReason = (error: Error | null | undefined): CloseReason => {
	if (error === null || error === undefined) {
		return 'ended';
	}

	if (error instanceof ProtectRtspGuardError) {
		return error.reason;
	}

	return (error as NodeJS.ErrnoException).code === 'ERR_STREAM_PREMATURE_CLOSE' ? 'ended' : 'error';
};

const refusalFor = (error: ProtectApiError): RefusalReason => {
	if (TLS_FAILURES.has(error.category) || error.category === ProtectErrorCategory.VALIDATION) {
		return 'tls';
	}

	return error.category === ProtectErrorCategory.TIMEOUT ? 'timeout' : 'unreachable';
};

/** A caller's remaining budget; without a deadline every step keeps its own bound. */
class PrepareBudget {
	private readonly deadlineAt: number | null;

	constructor(deadlineMs: number | undefined) {
		this.deadlineAt = deadlineMs === undefined ? null : Date.now() + Math.max(0, deadlineMs);
	}

	/** Milliseconds left, at most `cap`. */
	remaining(cap: number): number {
		return this.deadlineAt === null ? cap : Math.min(cap, this.deadlineAt - Date.now());
	}

	hasDeadline(): boolean {
		return this.deadlineAt !== null;
	}
}

interface PreflightFlight {
	promise: Promise<void>;
	controller: AbortController;
	waiters: number;
	settled: boolean;
}

/**
 * The verified hop between go2rtc and the console's RTSPS port (D1, D11, D12). go2rtc gets a plain `rtsp://` URL to a
 * bridge listener; each accepted connection opens its own TLS connection to the console, verified exactly like the API
 * (`connectVerifiedProtectTls` with the running session's plan), and only then are bytes piped, unchanged except that
 * an RTSP redirect from the console closes both sides.
 *
 * Listeners are keyed by `<relay mode, relay generation, bind address, upstream port>` (R1) and stay open while the
 * plugin is enabled and the relay runs, because go2rtc re-dials the same URL; a session end or an upstream change
 * closes connections, not listeners. Nothing here sees the alias as data: it travels inside go2rtc's request line and is
 * never parsed into a log, an error or the verification map.
 */
@Injectable()
export class ProtectStreamBridgeService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, 'ProtectStreamBridgeService');
	private readonly failureLog = new ProtectFailureLogLimiter();
	private readonly ca: (string | Buffer)[] | undefined;

	private readonly listeners = new Map<string, BridgeListener>();
	/** Single-flight listener opening per key (R11). */
	private readonly opening = new Map<string, Promise<BridgeListener>>();
	/** External relay routes per relay generation, learnt once (single-flight). */
	private readonly routes = new Map<string, Promise<BridgeRoute>>();
	private readonly connections = new Set<BridgeConnection>();
	private readonly closing = new Set<Promise<void>>();
	private readonly verification = new Map<string, VerificationEntry>();
	private readonly handshakes: number[] = [];
	/** Pre-flights in flight, keyed `<session>:<host>:<port>`; each holds one slot of the connection cap. */
	private readonly preflights = new Map<string, PreflightFlight>();

	private sessionGeneration = 0;
	private destroyed = false;
	/** Aborted by `onModuleDestroy`: cancels pre-flights and the external relay probe still in flight. */
	private lifetime = new AbortController();
	private unsubscribeSession: (() => void) | null = null;
	private unsubscribeRelay: (() => void) | null = null;

	constructor(
		private readonly connector: ProtectConnectorService,
		private readonly go2rtc: Go2rtcService,
		private readonly configService: ConfigService,
		@Optional() @Inject(PROTECT_TRUSTED_CA) trustedCa?: string,
	) {
		this.ca = withExtraCa(trustedCa);
	}

	/** Slots counted against PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS: open connections and pre-flights in flight. */
	private get occupiedSlots(): number {
		return this.connections.size + this.preflights.size;
	}

	get connectionCount(): number {
		return this.connections.size;
	}

	onModuleInit(): void {
		this.destroyed = false;

		if (this.lifetime.signal.aborted) {
			this.lifetime = new AbortController();
		}

		this.unsubscribeSession ??= this.connector.onSessionChange((session) => this.onSessionChange(session === null));
		this.unsubscribeRelay ??= this.go2rtc.subscribe((status) => this.onRelayStatus(status));
	}

	async onModuleDestroy(): Promise<void> {
		this.destroyed = true;
		this.lifetime.abort();
		this.unsubscribeSession?.();
		this.unsubscribeSession = null;
		this.unsubscribeRelay?.();
		this.unsubscribeRelay = null;

		[...this.listeners.values()].forEach((listener) => this.closeListener(listener));
		[...this.connections].forEach((connection) => this.closeConnection(connection, null));
		this.routes.clear();
		this.verification.clear();
		this.handshakes.length = 0;
		this.preflights.clear();

		// A bind still in flight sees `destroyed` when it completes and closes its listener at once.
		await Promise.allSettled([...this.opening.values()]);
		await Promise.all([...this.closing]);
	}

	/**
	 * Opens or reuses the listener for (relay, upstream port) and runs one verified pre-flight handshake to `upstream`.
	 * The pre-flight only reports (it writes nothing): every accepted connection is verified on its own. Rejects
	 * ProtectApiError: tls_untrusted / tls_fingerprint_mismatch (verification failed), unavailable (no session, relay not
	 * running, invalid stored override, bind failure, listener cap, external relay address unknown, or the session or
	 * relay changed meanwhile), timeout, unreachable, cancelled (caller's signal or module destroy).
	 *
	 * The upstream host is not the caller's to choose (M2): it is `getUpstreamHost()`, the rule every accepted connection
	 * uses, and verification is recorded under it. The caller names only the console stream port.
	 */
	async prepare(upstream: { port: number }, options: ProtectBridgePrepareOptions = {}): Promise<ProtectBridgeEndpoint> {
		const { signal } = options;
		const budget = new PrepareBudget(options.deadlineMs);

		if (signal?.aborted === true) {
			throw bridgeError(ProtectErrorCategory.CANCELLED);
		}

		if (budget.remaining(1) <= 0) {
			throw bridgeError(ProtectErrorCategory.TIMEOUT);
		}

		if (this.destroyed || !isValidPort(upstream.port)) {
			throw bridgeError(ProtectErrorCategory.UNAVAILABLE);
		}

		const target = this.connector.getStreamTlsTarget();
		const relay = this.currentRelay();
		// The same rule as every accepted connection (M2): the caller names only the console port.
		const host = target === null ? null : this.resolveUpstreamHost(target);

		if (target === null || relay === null || host === null) {
			throw bridgeError(ProtectErrorCategory.UNAVAILABLE);
		}

		// The session's TLS plan whatever host the stream goes to (R8); a broken plan throws `validation`.
		const plan = planProtectTls(target.consoleHost, target.tls);
		const sessionGeneration = this.sessionGeneration;
		const isCurrent = (): boolean =>
			!this.destroyed &&
			this.sessionGeneration === sessionGeneration &&
			this.isRelayCurrent(relay) &&
			// The host is read again after every await: an override change meanwhile makes this call stale.
			this.getUpstreamHost() === host;

		const cancel = signal === undefined ? this.lifetime.signal : AbortSignal.any([signal, this.lifetime.signal]);
		const route = await this.withBudget(this.routeFor(relay), budget, cancel);

		if (!isCurrent()) {
			throw bridgeError(ProtectErrorCategory.UNAVAILABLE);
		}

		// The bind is single-flight and may finish after this caller gave up: its deadline and signal still settle the call.
		const acquiring = this.acquireListener(relay, route, upstream.port);
		let listener: BridgeListener;

		try {
			listener = await this.withBudget(acquiring, budget, cancel);
		} catch (error) {
			// A listener whose bind completes after every caller left is released; one another caller still awaits is kept
			// (`releaseIfUnused` re-checks claims, hand-out and connections once those callers have run).
			acquiring.then(
				(late) => setImmediate(() => this.releaseIfUnused(late)),
				() => undefined,
			);

			throw error;
		}

		listener.claims += 1;

		try {
			if (!isCurrent() || listener.closed) {
				throw bridgeError(ProtectErrorCategory.UNAVAILABLE);
			}

			this.closeOtherUpstreams(listener, host);

			await this.preflight(host, upstream.port, plan, budget, cancel, sessionGeneration);

			// A stale call only rejects; the listener may already be in someone else's hands (I1). A listener that
			// failed or closed meanwhile is never handed out.
			if (!isCurrent() || listener.closed) {
				throw bridgeError(ProtectErrorCategory.UNAVAILABLE);
			}

			listener.handedOut = true;

			return { host: route.bindAddress, port: listener.port };
		} finally {
			listener.claims -= 1;
			this.releaseIfUnused(listener);
		}
	}

	/**
	 * One verified handshake that only reports: the socket is destroyed at once, nothing is written. Concurrent calls
	 * for one upstream and session share one handshake; the shared handshake consumes the M5 allowance and holds a slot
	 * of the connection cap until it settles. An exhausted allowance or cap rejects `unavailable` with no handshake.
	 * Every caller waits with its own deadline and signal; the handshake runs with the full timeout and is aborted only
	 * while it is running and no caller waits for it any more.
	 */
	private preflight(
		host: string,
		port: number,
		plan: ProtectTlsConnectPlan,
		budget: PrepareBudget,
		signal: AbortSignal,
		sessionGeneration: number,
	): Promise<void> {
		const key = `${sessionGeneration}:${verificationKey(host, port)}`;
		let flight = this.preflights.get(key);

		if (flight === undefined) {
			if (budget.remaining(1) <= 0) {
				throw bridgeError(ProtectErrorCategory.TIMEOUT);
			}

			if (this.occupiedSlots >= PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS) {
				this.logRefused('limit');

				return Promise.reject(bridgeError(ProtectErrorCategory.UNAVAILABLE));
			}

			if (!this.consumeHandshake()) {
				this.logRefused('rate');

				return Promise.reject(bridgeError(ProtectErrorCategory.UNAVAILABLE));
			}

			const controller = new AbortController();
			const started: PreflightFlight = { promise: Promise.resolve(), controller, waiters: 0, settled: false };

			this.preflights.set(key, started);
			started.promise = this.handshake(
				host,
				port,
				plan,
				// The full timeout: the handshake is shared, so no single caller's deadline may cut it short.
				PROTECT_STREAM_BRIDGE_HANDSHAKE_TIMEOUT_MS,
				AbortSignal.any([controller.signal, this.lifetime.signal]),
				sessionGeneration,
			).finally(() => {
				started.settled = true;

				if (this.preflights.get(key) === started) {
					this.preflights.delete(key);
				}
			});
			// Never an unhandled rejection when every waiter has given up.
			started.promise.catch(() => undefined);
			flight = started;
		}

		const joined = flight;

		joined.waiters += 1;

		const wait = this.withBudget(joined.promise, budget, signal);
		// Whatever the outcome (success, failure, deadline, abort) this caller stops counting; the handshake is
		// aborted only when it is still running and nobody waits for it any more.
		const leave = (): void => {
			joined.waiters -= 1;

			if (joined.waiters <= 0 && !joined.settled) {
				joined.controller.abort();
			}
		};

		wait.then(leave, leave);

		return wait;
	}

	private async handshake(
		host: string,
		port: number,
		plan: ProtectTlsConnectPlan,
		handshakeTimeoutMs: number,
		signal: AbortSignal,
		sessionGeneration: number,
	): Promise<void> {
		let verified: Awaited<ReturnType<typeof connectVerifiedProtectTls>>;

		try {
			verified = await connectVerifiedProtectTls({ host, port, plan, ca: this.ca, handshakeTimeoutMs, signal });
		} catch (error) {
			const failure = toProtectApiError(error, 'tls');

			if (TLS_FAILURES.has(failure.category)) {
				this.record(host, port, 'unverified', sessionGeneration);
			}

			throw failure;
		}

		verified.socket.destroy();
		this.record(host, port, 'verified', sessionGeneration);
	}

	/**
	 * Closes a listener nobody holds: never handed out, no `prepare()` still working with it and no connection. Covers a
	 * failed pre-flight on a new port and a stale call that opened it (M3, R11); a handed-out listener is never touched.
	 */
	private releaseIfUnused(listener: BridgeListener): void {
		if (!listener.handedOut && listener.claims === 0 && listener.connections.size === 0) {
			this.closeListener(listener);
		}
	}

	/**
	 * Host the bridge connects to right now: a valid `stream_host_override`, else the session's console host. Null
	 * without a session or with an invalid stored override. `getVerification` results are recorded under this host.
	 */
	getUpstreamHost(): string | null {
		const target = this.connector.getStreamTlsTarget();

		return target === null ? null : this.resolveUpstreamHost(target);
	}

	/**
	 * The event that also drives the connector's `onConfigChanged` (via the managed service manager). A new
	 * `stream_host_override` changes the upstream at once: every connection to another host closes (M1); an invalid
	 * override closes them all. Listeners stay.
	 */
	@OnEvent(ConfigEventType.CONFIG_UPDATED)
	handleConfigUpdated(payload?: { source: string; type: 'plugin' | 'module' | 'section' }): void {
		if (
			payload?.type === 'module' ||
			(payload?.type === 'plugin' && payload.source !== DEVICES_UNIFI_PROTECT_PLUGIN_NAME)
		) {
			return;
		}

		const host = this.getUpstreamHost();

		for (const listener of [...this.listeners.values()]) {
			this.closeOtherUpstreams(listener, host);
		}
	}

	/**
	 * Last pre-flight or connection result for that host and port in the current session (R5). An `unverified` result
	 * is forgotten after PROTECT_STREAM_AVAILABILITY_TTL_MS (R4), so the profile is offered and checked again.
	 */
	getVerification(upstream: { host: string; port: number }): ProtectBridgeVerification {
		if (typeof upstream.host !== 'string' || !isValidPort(upstream.port)) {
			return 'unknown';
		}

		const key = verificationKey(upstream.host, upstream.port);
		const entry = this.verification.get(key);

		if (entry === undefined) {
			return 'unknown';
		}

		if (entry.result === 'unverified' && Date.now() - entry.at >= PROTECT_STREAM_AVAILABILITY_TTL_MS) {
			this.verification.delete(key);

			return 'unknown';
		}

		return entry.result;
	}

	private onSessionChange(ended: boolean): void {
		this.sessionGeneration += 1;
		this.verification.clear();

		[...this.connections].forEach((connection) => this.closeConnection(connection, null));

		// A disabled plugin closes its listeners too; a session that is only lost keeps them for go2rtc's re-dials.
		if (ended && !this.isPluginEnabled()) {
			[...this.listeners.values()].forEach((listener) => this.closeListener(listener));
			this.routes.clear();
		}
	}

	private onRelayStatus(status: Go2rtcRelayStatus): void {
		const running = status.state === 'running' && status.mode !== 'disabled';

		for (const listener of [...this.listeners.values()]) {
			if (!running || listener.relay.mode !== status.mode || listener.relay.generation !== status.generation) {
				this.closeListener(listener);
			}
		}

		for (const key of [...this.routes.keys()]) {
			if (!running || key !== this.relayKey({ mode: status.mode as RelayMode, generation: status.generation })) {
				this.routes.delete(key);
			}
		}
	}

	private currentRelay(): RelayRef | null {
		const status = this.go2rtc.getStatus();

		if (status.state !== 'running' || status.mode === 'disabled') {
			return null;
		}

		return { mode: status.mode, generation: status.generation };
	}

	private isRelayCurrent(relay: RelayRef): boolean {
		const current = this.currentRelay();

		return current !== null && current.mode === relay.mode && current.generation === relay.generation;
	}

	private relayKey(relay: RelayRef): string {
		return `${relay.mode}|${relay.generation}`;
	}

	private isPluginEnabled(): boolean {
		try {
			return this.configService.getPluginConfig<ProtectConfigModel>(DEVICES_UNIFI_PROTECT_PLUGIN_NAME).enabled === true;
		} catch {
			return false;
		}
	}

	/** R1: a valid stored override, else the session's console host; null for an invalid override (fail closed). */
	private resolveUpstreamHost(target: ProtectStreamTlsTarget): string | null {
		let override: unknown;

		try {
			override =
				this.configService.getPluginConfig<ProtectConfigModel>(DEVICES_UNIFI_PROTECT_PLUGIN_NAME).streamHostOverride ??
				null;
		} catch {
			return null;
		}

		if (override === null) {
			return target.consoleHost;
		}

		if (isValidProtectHost(override)) {
			return override;
		}

		// Here, the one place every caller goes through (prepare, accepted connections, the provider's lookups).
		this.logLimited('UniFi Protect stream host override is invalid', 'warn');

		return null;
	}

	/** Races `work` against the caller's deadline and signal; the work itself keeps running for other joiners. */
	private withBudget<T>(work: Promise<T>, budget: PrepareBudget, signal: AbortSignal | undefined): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			let timer: ReturnType<typeof setTimeout> | null = null;

			const cleanup = (): void => {
				if (timer !== null) {
					clearTimeout(timer);
				}

				signal?.removeEventListener('abort', onAbort);
			};
			const onAbort = (): void => {
				cleanup();
				reject(bridgeError(ProtectErrorCategory.CANCELLED));
			};

			if (signal?.aborted === true) {
				reject(bridgeError(ProtectErrorCategory.CANCELLED));

				return;
			}

			if (budget.hasDeadline()) {
				timer = setTimeout(
					() => {
						cleanup();
						reject(bridgeError(ProtectErrorCategory.TIMEOUT));
					},
					Math.max(0, budget.remaining(Number.MAX_SAFE_INTEGER)),
				);
				timer.unref();
			}

			signal?.addEventListener('abort', onAbort, { once: true });

			work.then(
				(value) => {
					cleanup();
					resolve(value);
				},
				(error: unknown) => {
					cleanup();
					reject(error instanceof ProtectApiError ? error : bridgeError(ProtectErrorCategory.UNAVAILABLE));
				},
			);
		});
	}

	private routeFor(relay: RelayRef): Promise<BridgeRoute> {
		if (relay.mode === 'managed') {
			return Promise.resolve(LOOPBACK_ROUTE);
		}

		const key = this.relayKey(relay);
		let pending = this.routes.get(key);

		if (pending === undefined) {
			const learning = this.learnExternalRoute();

			pending = learning;
			this.routes.set(key, learning);
			learning.catch(() => {
				if (this.routes.get(key) === learning) {
					this.routes.delete(key);
				}
			});
		}

		return pending;
	}

	/**
	 * D11 external mode: a loopback relay gets loopback. Any other relay host gets the local address the backend uses
	 * to reach it (one TCP connect to the relay API) and, frozen before any listener opens, the allow-list of its
	 * addresses: the probe's peer plus every address the name resolves to. Anything not learnt fails closed.
	 */
	private async learnExternalRoute(): Promise<BridgeRoute> {
		const baseUrl = this.go2rtc.getClient()?.baseUrl;
		let url: URL;

		try {
			url = new URL(baseUrl ?? '');
		} catch {
			throw bridgeError(ProtectErrorCategory.UNAVAILABLE);
		}

		const host = url.hostname.replace(/^\[(.*)\]$/, '$1');

		if (isLoopbackHost(host)) {
			return host === '::1' ? Object.freeze({ bindAddress: '::1', allowedPeers: null }) : LOOPBACK_ROUTE;
		}

		// M6: a URL without a port reaches the relay on its scheme's port.
		const port = url.port !== '' ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
		const probe = await this.probeRelay(host, port, this.lifetime.signal);
		const addresses = await this.lookupRelay(host);
		const allowedPeers = new Set<string>([probe.remote]);

		for (const address of addresses) {
			const normalized = normalizeAddress(address);

			if (normalized !== null) {
				allowedPeers.add(normalized);
			}
		}

		return Object.freeze({ bindAddress: probe.local, allowedPeers });
	}

	private probeRelay(host: string, port: number, lifetime: AbortSignal): Promise<{ local: string; remote: string }> {
		return new Promise((resolve, reject) => {
			if (lifetime.aborted) {
				reject(bridgeError(ProtectErrorCategory.CANCELLED));

				return;
			}

			let settled = false;
			const socket = net.connect({ host, port });
			const onAbort = (): void => finish(null, ProtectErrorCategory.CANCELLED);
			const finish = (
				result: { local: string; remote: string } | null,
				category = ProtectErrorCategory.UNAVAILABLE,
			): void => {
				if (settled) {
					return;
				}

				settled = true;
				clearTimeout(timer);
				lifetime.removeEventListener('abort', onAbort);
				socket.destroy();

				if (result === null) {
					reject(bridgeError(category));
				} else {
					resolve(result);
				}
			};
			const timer = setTimeout(() => finish(null), GO2RTC_HTTP_TIMEOUT_MS);

			timer.unref();
			lifetime.addEventListener('abort', onAbort, { once: true });
			socket.on('error', () => finish(null));
			socket.once('connect', () => {
				const local = normalizeAddress(socket.localAddress);
				const remote = normalizeAddress(socket.remoteAddress);

				finish(local !== null && remote !== null ? { local, remote } : null);
			});
		});
	}

	private lookupRelay(host: string): Promise<string[]> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(bridgeError(ProtectErrorCategory.UNAVAILABLE)), GO2RTC_HTTP_TIMEOUT_MS);

			timer.unref();
			lookup(host, { all: true }).then(
				(entries) => {
					clearTimeout(timer);
					resolve(entries.map((entry) => entry.address));
				},
				() => {
					clearTimeout(timer);
					reject(bridgeError(ProtectErrorCategory.UNAVAILABLE));
				},
			);
		});
	}

	private async acquireListener(relay: RelayRef, route: BridgeRoute, upstreamPort: number): Promise<BridgeListener> {
		const key = `${this.relayKey(relay)}|${route.bindAddress}|${upstreamPort}`;
		const existing = this.listeners.get(key);

		if (existing !== undefined) {
			return existing;
		}

		const pending = this.opening.get(key);

		if (pending !== undefined) {
			return pending;
		}

		if (this.listeners.size + this.opening.size >= PROTECT_STREAM_BRIDGE_MAX_LISTENERS) {
			throw bridgeError(ProtectErrorCategory.UNAVAILABLE);
		}

		const opening = this.openListener(key, relay, route, upstreamPort).finally(() => {
			this.opening.delete(key);
		});

		this.opening.set(key, opening);

		return opening;
	}

	private async openListener(
		key: string,
		relay: RelayRef,
		route: BridgeRoute,
		upstreamPort: number,
	): Promise<BridgeListener> {
		// Accepted sockets are not read until their upstream is verified (R13).
		const server = net.createServer({ pauseOnConnect: true });
		const listener: BridgeListener = {
			key,
			relay,
			route,
			upstreamPort,
			server,
			port: 0,
			connections: new Set(),
			handedOut: false,
			claims: 0,
			closed: false,
		};

		server.on('connection', (socket: net.Socket) => this.accept(listener, socket));
		// M4: a failing listener closes; errors while binding reject below.
		server.on('error', () => {
			if (listener.port !== 0 && !listener.closed) {
				this.logLimited('UniFi Protect stream bridge listener failed', 'warn');
				this.closeListener(listener);
			}
		});

		try {
			await new Promise<void>((resolve, reject) => {
				server.once('error', reject);
				server.listen(0, route.bindAddress, () => {
					server.removeListener('error', reject);
					resolve();
				});
			});
		} catch {
			this.closeListener(listener);

			throw bridgeError(ProtectErrorCategory.UNAVAILABLE);
		}

		listener.port = (server.address() as AddressInfo).port;

		if (this.destroyed || !this.isRelayCurrent(relay) || listener.closed) {
			this.closeListener(listener);

			throw bridgeError(ProtectErrorCategory.UNAVAILABLE);
		}

		this.listeners.set(key, listener);
		this.logger.debug('UniFi Protect stream bridge listening');

		return listener;
	}

	private closeListener(listener: BridgeListener): void {
		if (listener.closed) {
			return;
		}

		listener.closed = true;

		if (this.listeners.get(listener.key) === listener) {
			this.listeners.delete(listener.key);
		}

		[...listener.connections].forEach((connection) => this.closeConnection(connection, null));

		const closed = new Promise<void>((resolve) => {
			listener.server.close(() => resolve());
		});

		this.closing.add(closed);
		void closed.finally(() => this.closing.delete(closed));
	}

	private accept(listener: BridgeListener, socket: net.Socket): void {
		// R11: checked synchronously, before anything else touches the socket, against the list frozen before listen().
		const allowedPeers = listener.route.allowedPeers;

		if (allowedPeers !== null && !allowedPeers.has(normalizeAddress(socket.remoteAddress) ?? '')) {
			socket.on('error', ignoreError);
			socket.destroy();
			this.logRefused('peer');

			return;
		}

		socket.on('error', ignoreError);
		socket.pause();

		if (listener.closed || this.destroyed) {
			socket.destroy();

			return;
		}

		if (this.occupiedSlots >= PROTECT_STREAM_BRIDGE_MAX_CONNECTIONS) {
			socket.destroy();
			this.logRefused('limit');

			return;
		}

		// R1: no session, no upstream connect.
		const target = this.connector.getStreamTlsTarget();

		if (target === null) {
			socket.destroy();
			this.logRefused('session');

			return;
		}

		const host = this.resolveUpstreamHost(target);

		if (host === null) {
			socket.destroy();
			this.logRefused('upstream');

			return;
		}

		let plan: ProtectTlsConnectPlan;

		try {
			plan = planProtectTls(target.consoleHost, target.tls);
		} catch {
			socket.destroy();
			this.logRefused('tls');

			return;
		}

		if (!this.consumeHandshake()) {
			socket.destroy();
			this.logRefused('rate');

			return;
		}

		this.closeOtherUpstreams(listener, host);

		const connection: BridgeConnection = {
			listener,
			client: socket,
			upstream: null,
			guard: null,
			host,
			sessionGeneration: this.sessionGeneration,
			abort: new AbortController(),
			idleTimer: null,
			lastActivityAt: 0,
			closed: false,
		};
		const onEarlyClose = (): void => this.closeConnection(connection, 'ended');

		listener.connections.add(connection);
		this.connections.add(connection);
		socket.once('close', onEarlyClose);

		// One attempt per connection, never a retry: go2rtc re-dials on its own.
		connectVerifiedProtectTls({
			host,
			port: listener.upstreamPort,
			plan,
			ca: this.ca,
			handshakeTimeoutMs: PROTECT_STREAM_BRIDGE_HANDSHAKE_TIMEOUT_MS,
			signal: connection.abort.signal,
		}).then(
			({ socket: upstream }) => {
				socket.removeListener('close', onEarlyClose);
				upstream.on('error', ignoreError);

				if (connection.closed || connection.sessionGeneration !== this.sessionGeneration) {
					upstream.destroy();
					this.closeConnection(connection, null);

					return;
				}

				this.record(host, listener.upstreamPort, 'verified', connection.sessionGeneration);
				this.pipe(connection, upstream);
			},
			(error: unknown) => {
				if (connection.closed) {
					return;
				}

				const failure = toProtectApiError(error, 'tls');

				if (TLS_FAILURES.has(failure.category)) {
					this.record(host, listener.upstreamPort, 'unverified', connection.sessionGeneration);
				}

				this.closeConnection(connection, null);
				this.logRefused(refusalFor(failure));
			},
		);
	}

	private pipe(connection: BridgeConnection, upstream: Duplex): void {
		// One guard per connection, never reused: it counts this connection's requests and answers.
		const guard = new ProtectRtspResponseGuard();
		const requests = new Transform({
			transform: (chunk: Buffer, _encoding, callback) => {
				this.touch(connection);
				// Synchronously, before the chunk goes upstream: the guard learns which reader in go2rtc gets each answer.
				guard.observeRequests(chunk);

				if (guard.destroyed) {
					// A request the guard cannot follow ends the connection; the chunk that broke it stays here.
					callback();

					return;
				}

				callback(null, chunk);
			},
		});
		const responses = new Transform({
			transform: (chunk: Buffer, _encoding, callback) => {
				this.touch(connection);
				callback(null, chunk);
			},
		});

		connection.upstream = upstream;
		connection.guard = guard;

		pipeline(connection.client, requests, upstream, (error) => this.closeConnection(connection, closeReason(error)));
		pipeline(upstream, guard, responses, connection.client, (error) =>
			this.closeConnection(connection, closeReason(error)),
		);

		this.touch(connection);
	}

	/** Traffic in either direction; the idle timer is re-armed lazily, not per chunk. */
	private touch(connection: BridgeConnection): void {
		connection.lastActivityAt = Date.now();

		if (connection.idleTimer === null && !connection.closed) {
			this.armIdle(connection, PROTECT_STREAM_BRIDGE_IDLE_TIMEOUT_MS);
		}
	}

	private armIdle(connection: BridgeConnection, delayMs: number): void {
		connection.idleTimer = setTimeout(() => {
			connection.idleTimer = null;

			if (connection.closed) {
				return;
			}

			const idleFor = Date.now() - connection.lastActivityAt;

			if (idleFor >= PROTECT_STREAM_BRIDGE_IDLE_TIMEOUT_MS) {
				this.closeConnection(connection, 'idle');
			} else {
				this.armIdle(connection, PROTECT_STREAM_BRIDGE_IDLE_TIMEOUT_MS - idleFor);
			}
		}, delayMs);
		connection.idleTimer.unref();
	}

	/** Destroys both sides; the first reason wins, and a null reason (the bridge's own decision) is not logged. */
	private closeConnection(connection: BridgeConnection, reason: CloseReason | null): void {
		if (connection.closed) {
			return;
		}

		connection.closed = true;

		if (connection.idleTimer !== null) {
			clearTimeout(connection.idleTimer);
			connection.idleTimer = null;
		}

		connection.abort.abort();
		connection.client.destroy();
		connection.upstream?.destroy();
		connection.guard?.destroy();
		connection.listener.connections.delete(connection);
		this.connections.delete(connection);
		// A stray connection can be the only thing that pinned a listener nobody was handed.
		this.releaseIfUnused(connection.listener);

		if (reason !== null) {
			this.logLimited(
				`UniFi Protect stream bridge closed a connection (${reason})`,
				reason === 'ended' || reason === 'idle' ? 'debug' : 'warn',
			);
		}
	}

	/** R1: a connection to another upstream host than the current one is closed; the listener stays. */
	private closeOtherUpstreams(listener: BridgeListener, host: string | null): void {
		const current = host?.toLowerCase() ?? null;

		[...listener.connections]
			.filter((connection) => connection.host.toLowerCase() !== current)
			.forEach((connection) => this.closeConnection(connection, null));
	}

	/** M5: at most PROTECT_STREAM_BRIDGE_MAX_HANDSHAKES upstream handshakes per window, across every listener. */
	private consumeHandshake(): boolean {
		const now = Date.now();

		while (this.handshakes.length > 0 && now - this.handshakes[0] >= PROTECT_STREAM_BRIDGE_HANDSHAKE_WINDOW_MS) {
			this.handshakes.shift();
		}

		if (this.handshakes.length >= PROTECT_STREAM_BRIDGE_MAX_HANDSHAKES) {
			return false;
		}

		this.handshakes.push(now);

		return true;
	}

	private record(host: string, port: number, result: VerificationEntry['result'], sessionGeneration: number): void {
		if (sessionGeneration !== this.sessionGeneration || this.destroyed) {
			return;
		}

		const key = verificationKey(host, port);

		this.verification.delete(key);
		this.verification.set(key, { result, at: Date.now() });

		while (this.verification.size > MAX_VERIFICATION_ENTRIES) {
			this.verification.delete(this.verification.keys().next().value as string);
		}
	}

	private logRefused(reason: RefusalReason): void {
		this.logLimited(`UniFi Protect stream bridge refused a connection (${reason})`, 'warn');
	}

	/** Fixed texts only: never an address, a port, a URL or a byte of the stream. */
	private logLimited(text: string, level: 'warn' | 'debug'): void {
		const decision = this.failureLog.consume(text);

		if (!decision.log) {
			return;
		}

		const line = decision.suppressed > 0 ? `${text} (${decision.suppressed} similar suppressed)` : text;

		if (level === 'warn') {
			this.logger.warn(line);
		} else {
			this.logger.debug(line);
		}
	}
}
