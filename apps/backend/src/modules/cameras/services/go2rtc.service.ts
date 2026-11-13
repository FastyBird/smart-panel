import { randomBytes } from 'crypto';
import { accessSync, chmodSync, constants, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { getEnvValue } from '../../../common/utils/config.utils';
import { ConfigService } from '../../config/services/config.service';
import { BaseManagedExtensionService } from '../../extensions/services/base-managed-extension.service';
import { ConfigChangeResult } from '../../extensions/services/managed-extension-service.interface';
import { isValidGo2rtcBinaryPath, isValidGo2rtcExternalUrl, normalizeGo2rtcExternalUrl } from '../cameras.config.utils';
import {
	CAMERAS_MODULE_NAME,
	GO2RTC_API_USERNAME,
	GO2RTC_CONFIG_DIRNAME,
	GO2RTC_CONFIG_FILE_PREFIX,
	GO2RTC_CONFIG_FILE_SUFFIX,
	GO2RTC_DEFAULT_API_PORT,
	GO2RTC_DEFAULT_RTSP_PORT,
	GO2RTC_PROBE_INTERVAL_MS,
	GO2RTC_READY_POLL_MS,
	GO2RTC_READY_TIMEOUT_MS,
	GO2RTC_RESTART_BACKOFF_MS,
	GO2RTC_STABLE_RUN_MS,
	Go2rtcMode,
} from '../cameras.constants';
import { Go2rtcApiError, Go2rtcUnavailableException, errorName } from '../cameras.exceptions';
import { CamerasConfigModel } from '../models/config.model';

import { Go2rtcApiClient, Go2rtcEndpoint, Go2rtcInfo } from './go2rtc-api.client';
import { buildGo2rtcConfig } from './go2rtc-config';
import { generateInstallationId, loadOrCreateInstallationId } from './go2rtc-installation-id';
import { Go2rtcExitInfo, Go2rtcProcessService } from './go2rtc-process.service';
import { redactGo2rtcOutput } from './go2rtc-redaction';
import { Go2rtcSecretsRegistry } from './go2rtc-secrets.registry';

export type Go2rtcRelayState = 'disabled' | 'starting' | 'running' | 'unavailable' | 'error';

export type Go2rtcRelayReason =
	| 'mode_disabled'
	| 'module_disabled'
	| 'binary_path_invalid'
	| 'binary_missing'
	| 'binary_not_executable'
	| 'external_url_missing'
	| 'external_unreachable'
	| 'start_timeout'
	| 'port_in_use'
	| 'crashed';

export interface Go2rtcRelayStatus {
	mode: Go2rtcMode;
	state: Go2rtcRelayState;
	reason: Go2rtcRelayReason | null;
	version: string | null;
	/** +1 on every spawn, every external (re)connect and every mode change. */
	generation: number;
}

interface AppliedConfig {
	mode: Go2rtcMode;
	binaryPath: string;
	externalUrl: string | null;
}

/** One spawn of the managed child. Everything a spawn owns lives here, so that a late callback can be recognised. */
interface ManagedRun {
	epoch: number;
	phase: 'starting' | 'running';
	ended: boolean;
	configPath: string;
	client: Go2rtcApiClient;
	/** The first line of the config file; the running instance must serve it back on `GET /api/config`. */
	instanceLine: string;
	releaseSecrets: () => void;
	pollTimer: ReturnType<typeof setTimeout> | null;
	deadlineTimer: ReturnType<typeof setTimeout> | null;
	stableTimer: ReturnType<typeof setTimeout> | null;
	probeTimer: ReturnType<typeof setTimeout> | null;
	probeFailures: number;
}

const OUTPUT_TAIL_LINES = 5;
const CONFIG_FILE_PATTERN = new RegExp(
	`^${GO2RTC_CONFIG_FILE_PREFIX}[A-Za-z0-9_-]+${GO2RTC_CONFIG_FILE_SUFFIX.replace('.', '\\.')}$`,
);
const PROBE_FAILURES_BEFORE_RESTART = 2;

const instanceLine = (secret: string): string => `# smart-panel-instance ${secret}`;

/**
 * The go2rtc relay: runs it as a supervised child (`managed`), uses one that already exists (`external`), or does
 * nothing (`disabled`). Owns the relay state machine that stream registration, the live gateway and the status route
 * read through `getStatus` and `subscribe`.
 *
 * `start` never throws for an unmet requirement (missing binary, bad external url, unreachable relay): the manager
 * raises an error notification for every rejected `start`, so such a state is reported through the relay status and
 * the service heals itself on retry or config change.
 *
 * go2rtc persists registered streams, source urls included, into the config file it was started with, so the file is
 * deleted whenever the child stops and regenerated, with a fresh api password, on every spawn. Its name carries a
 * random nonce: the api answers with the path of the config it runs, and only our child can know that exact path, so a
 * different service squatting on the api port is recognised before any credential or camera source is sent to it. The config file
 * operations are synchronous on purpose: they are tiny, happen only on lifecycle changes, and keep each state
 * transition free of interleaved I/O.
 */
@Injectable()
export class Go2rtcService extends BaseManagedExtensionService implements OnModuleDestroy {
	private readonly logger = createExtensionLogger(CAMERAS_MODULE_NAME, 'Go2rtcService');

	readonly owner = { kind: 'module', type: CAMERAS_MODULE_NAME } as const;
	readonly serviceId = 'go2rtc';
	readonly activationPolicy = 'owner-enabled' as const;

	private status: Go2rtcRelayStatus = {
		mode: 'disabled',
		state: 'disabled',
		reason: 'module_disabled',
		version: null,
		generation: 0,
	};
	private readonly listeners = new Set<(status: Go2rtcRelayStatus) => void>();

	/** Bumped by `start` and `stop`; every asynchronous continuation compares it to know it was superseded. */
	private epoch = 0;
	private applied: AppliedConfig | null = null;
	private run: ManagedRun | null = null;
	private attempts = 0;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;
	private externalClient: Go2rtcApiClient | null = null;
	private externalTimer: ReturnType<typeof setTimeout> | null = null;
	private outputTail: string[] = [];
	private installationId: string | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly nestConfigService: NestConfigService,
		private readonly processService: Go2rtcProcessService,
		private readonly secrets: Go2rtcSecretsRegistry,
	) {
		super();
	}

	/** Test seam: specs spy on it to return a mock client. */
	createClient(endpoint: Go2rtcEndpoint): Go2rtcApiClient {
		return new Go2rtcApiClient(endpoint);
	}

	async start(): Promise<void> {
		await this.withLock(async () => {
			if (this.state === 'started') {
				return;
			}

			if (this.processService.isRunning()) {
				this.state = 'error';

				throw new Go2rtcUnavailableException('The previous go2rtc process has not terminated');
			}

			const epoch = ++this.epoch;

			this.state = 'starting';

			try {
				await this.activate(epoch);
			} catch (error) {
				this.logger.error(`go2rtc relay failed to start error=${errorName(error)}`);

				await this.teardown().catch(() => undefined);

				this.state = 'error';

				throw error;
			}

			this.state = 'started';
		});
	}

	/** Rejects only when the child cannot be confirmed terminated. */
	async stop(): Promise<void> {
		this.epoch++;

		await this.withLock(async () => {
			if (this.state === 'stopped') {
				return;
			}

			this.state = 'stopping';

			try {
				await this.teardown();
			} catch (error) {
				this.state = 'error';
				this.logger.error(`go2rtc could not be confirmed stopped error=${errorName(error)}`);
				this.update({ state: 'error', reason: 'crashed', version: null });

				throw new Go2rtcUnavailableException('The go2rtc process could not be confirmed stopped');
			}

			this.update({ state: 'disabled', reason: 'module_disabled', version: null });

			this.state = 'stopped';
		});
	}

	async onModuleDestroy(): Promise<void> {
		await this.stop().catch(() => undefined);
	}

	onConfigChanged(): Promise<ConfigChangeResult> {
		const { go2rtc } = this.getCamerasConfig();
		const applied = this.applied;

		return Promise.resolve({
			restartRequired:
				applied === null ||
				go2rtc.mode !== applied.mode ||
				go2rtc.binaryPath !== applied.binaryPath ||
				go2rtc.externalUrl !== applied.externalUrl,
		});
	}

	getStatus(): Go2rtcRelayStatus {
		return { ...this.status };
	}

	isRunning(): boolean {
		return this.status.state === 'running';
	}

	/** Reported to the service manager's status listing: a relay that is switched off is as healthy as a running one. */
	isHealthy(): Promise<boolean> {
		return Promise.resolve(this.status.state === 'running' || this.status.mode === 'disabled');
	}

	/**
	 * The random id that scopes this installation's stream names on a go2rtc it may share with others. Persisted in the
	 * go2rtc config directory; if that cannot be written the id lasts for this process only, so names stay unique but an
	 * orphan of an earlier run is no longer recognised.
	 */
	getInstallationId(): string {
		if (this.installationId === null) {
			try {
				this.installationId = loadOrCreateInstallationId(this.getConfigDir());
			} catch (error) {
				this.logger.warn(`go2rtc installation id could not be persisted error=${errorName(error)}`);

				this.installationId = generateInstallationId();
			}
		}

		return this.installationId;
	}

	/** Non-null only while the relay is running. */
	getClient(): Go2rtcApiClient | null {
		if (this.status.state !== 'running') {
			return null;
		}

		return this.status.mode === 'external' ? this.externalClient : (this.run?.client ?? null);
	}

	subscribe(listener: (status: Go2rtcRelayStatus) => void): () => void {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}

	private getCamerasConfig(): CamerasConfigModel {
		return this.configService.getModuleConfig<CamerasConfigModel>(CAMERAS_MODULE_NAME);
	}

	private async activate(epoch: number): Promise<void> {
		const { go2rtc } = this.getCamerasConfig();

		this.applied = { mode: go2rtc.mode, binaryPath: go2rtc.binaryPath, externalUrl: go2rtc.externalUrl };
		this.attempts = 0;

		if (go2rtc.mode === 'disabled') {
			this.update({ mode: 'disabled', state: 'disabled', reason: 'mode_disabled', version: null });
		} else if (go2rtc.mode === 'external') {
			await this.startExternal(epoch, go2rtc.externalUrl);
		} else {
			this.spawnManaged(epoch, go2rtc.binaryPath);
		}
	}

	// ---- external ----

	private async startExternal(epoch: number, externalUrl: string | null): Promise<void> {
		if (!isValidGo2rtcExternalUrl(externalUrl)) {
			this.update({ mode: 'external', state: 'unavailable', reason: 'external_url_missing', version: null });

			return;
		}

		this.externalClient = this.createClient({ baseUrl: normalizeGo2rtcExternalUrl(externalUrl), authorization: null });

		await this.probeExternal(epoch, this.externalClient);
	}

	private async probeExternal(epoch: number, client: Go2rtcApiClient): Promise<void> {
		let version: string | null = null;
		let reachable = false;

		try {
			version = (await client.getInfo()).version;
			reachable = true;
		} catch {
			// Reported through the relay status.
		}

		if (epoch !== this.epoch || client !== this.externalClient) {
			return;
		}

		if (reachable) {
			this.update({ mode: 'external', state: 'running', reason: null, version }, this.status.state !== 'running');
		} else {
			this.update({ mode: 'external', state: 'unavailable', reason: 'external_unreachable', version: null });
		}

		this.externalTimer = setTimeout(() => {
			this.externalTimer = null;

			void this.probeExternal(epoch, client);
		}, GO2RTC_PROBE_INTERVAL_MS);
		this.externalTimer.unref?.();
	}

	// ---- managed ----

	private spawnManaged(epoch: number, binaryPath: string): void {
		if (!isValidGo2rtcBinaryPath(binaryPath)) {
			this.update({ mode: 'managed', state: 'unavailable', reason: 'binary_path_invalid', version: null });

			return;
		}

		try {
			accessSync(binaryPath, constants.X_OK);
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;

			this.update({
				mode: 'managed',
				state: 'unavailable',
				reason: code === 'ENOENT' || code === 'ENOTDIR' ? 'binary_missing' : 'binary_not_executable',
				version: null,
			});

			return;
		}

		if (this.processService.isRunning()) {
			this.logger.error('go2rtc is still running from an earlier spawn; not starting a second child');
			this.update({ mode: 'managed', state: 'error', reason: 'crashed', version: null });

			return;
		}

		const apiPort = getEnvValue<number>(this.nestConfigService, 'FB_GO2RTC_API_PORT', GO2RTC_DEFAULT_API_PORT);
		const rtspPort = getEnvValue<number>(this.nestConfigService, 'FB_GO2RTC_RTSP_PORT', GO2RTC_DEFAULT_RTSP_PORT);
		const configDir = this.getConfigDir();
		const configPath = join(
			configDir,
			`${GO2RTC_CONFIG_FILE_PREFIX}${randomBytes(16).toString('base64url')}${GO2RTC_CONFIG_FILE_SUFFIX}`,
		);
		const password = randomBytes(24).toString('base64url');
		// Unlike the config path, which `ps` shows, this never appears in the arguments: only a process that can read the
		// 0600 config file, or that is our child, knows it.
		const instanceSecret = randomBytes(24).toString('base64url');
		const releasePassword = this.secrets.add(password);
		const releaseInstanceSecret = this.secrets.add(instanceSecret);
		const releaseSecrets = (): void => {
			releasePassword();
			releaseInstanceSecret();
		};

		try {
			this.writeConfigFile(
				configDir,
				configPath,
				`${instanceLine(instanceSecret)}\n${buildGo2rtcConfig({ apiPort, rtspPort, username: GO2RTC_API_USERNAME, password })}`,
			);
		} catch (error) {
			this.logger.error(`go2rtc config could not be written error=${errorName(error)}`);
			this.removeConfigFiles();
			releaseSecrets();
			this.noteFailure(epoch, 'crashed');

			return;
		}

		const run: ManagedRun = {
			epoch,
			phase: 'starting',
			ended: false,
			configPath,
			client: this.createClient({
				baseUrl: `http://127.0.0.1:${apiPort}`,
				authorization: `Basic ${Buffer.from(`${GO2RTC_API_USERNAME}:${password}`).toString('base64')}`,
			}),
			instanceLine: instanceLine(instanceSecret),
			releaseSecrets,
			pollTimer: null,
			deadlineTimer: null,
			stableTimer: null,
			probeTimer: null,
			probeFailures: 0,
		};

		this.run = run;
		this.update({ mode: 'managed', state: 'starting', reason: null, version: null }, true);

		// Each spawn has its own `run`: an exit that arrives late (the supervisor reports it on `close`, which a
		// grandchild holding the pipes can delay past the next spawn) finds its run ended and is ignored.
		this.processService.start({ binaryPath, configPath, cwd: configDir }, (exit) => void this.onChildExit(run, exit));

		run.deadlineTimer = setTimeout(() => void this.onReadyTimeout(run), GO2RTC_READY_TIMEOUT_MS);
		run.deadlineTimer.unref?.();

		void this.pollReady(run);
	}

	private async pollReady(run: ManagedRun): Promise<void> {
		if (!this.isLive(run) || run.phase !== 'starting') {
			return;
		}

		// The supervisor flips `isRunning` on `exit`, ahead of the `close`-based exit report.
		if (!this.processService.isRunning()) {
			await this.onChildGone(run, null);

			return;
		}

		let info: Go2rtcInfo | null = null;

		try {
			info = await run.client.getInfo();
		} catch {
			// Not listening yet.
		}

		if (!this.isLive(run) || run.phase !== 'starting') {
			return;
		}

		if (info === null) {
			run.pollTimer = setTimeout(() => void this.pollReady(run), GO2RTC_READY_POLL_MS);
			run.pollTimer.unref?.();

			return;
		}

		if (info.configPath !== run.configPath) {
			// Something else answered on our api port: it is not our child.
			await this.refuseForeignListener(run);

			return;
		}

		// The path is visible in the process arguments; the instance line in the file is not.
		let configText: string | null = null;

		try {
			configText = await run.client.getConfigText();
		} catch {
			// Not served yet: keep polling until the deadline.
		}

		if (!this.isLive(run) || run.phase !== 'starting') {
			return;
		}

		if (configText === null) {
			run.pollTimer = setTimeout(() => void this.pollReady(run), GO2RTC_READY_POLL_MS);
			run.pollTimer.unref?.();
		} else if (configText.split(/\r?\n/).includes(run.instanceLine)) {
			this.onReady(run, info.version);
		} else {
			await this.refuseForeignListener(run);
		}
	}

	private onReady(run: ManagedRun, version: string | null): void {
		this.clearTimer(run, 'pollTimer');
		this.clearTimer(run, 'deadlineTimer');

		run.phase = 'running';
		this.update({ mode: 'managed', state: 'running', reason: null, version });

		run.stableTimer = setTimeout(() => {
			run.stableTimer = null;
			this.attempts = 0;
		}, GO2RTC_STABLE_RUN_MS);
		run.stableTimer.unref?.();

		this.scheduleProbe(run);
	}

	private scheduleProbe(run: ManagedRun): void {
		run.probeTimer = setTimeout(() => void this.probe(run), GO2RTC_PROBE_INTERVAL_MS);
		run.probeTimer.unref?.();
	}

	private async probe(run: ManagedRun): Promise<void> {
		run.probeTimer = null;

		if (!this.isLive(run)) {
			return;
		}

		if (!this.processService.isRunning()) {
			await this.onChildGone(run, null);

			return;
		}

		let healthy = false;

		try {
			healthy = (await run.client.getInfo()).configPath === run.configPath;
		} catch {
			// Counted below.
		}

		if (!this.isLive(run)) {
			return;
		}

		if (healthy) {
			run.probeFailures = 0;
		} else if (++run.probeFailures >= PROBE_FAILURES_BEFORE_RESTART) {
			this.logger.warn('go2rtc stopped answering the health probe; restarting it');

			await this.onChildGone(run, null, 0);

			return;
		}

		this.scheduleProbe(run);
	}

	private async onChildExit(run: ManagedRun, exit: Go2rtcExitInfo): Promise<void> {
		if (!this.isLive(run)) {
			return;
		}

		this.logger.warn(`go2rtc exited code=${exit.code ?? 'none'} signal=${exit.signal ?? 'none'}`);

		await this.onChildGone(run, exit.spawnErrorCode);
	}

	private async onReadyTimeout(run: ManagedRun): Promise<void> {
		run.deadlineTimer = null;

		if (!this.isLive(run) || run.phase !== 'starting') {
			return;
		}

		const epoch = run.epoch;

		if (!(await this.halt(run))) {
			return;
		}

		await this.classifyStartFailure(epoch, 'start_timeout');
	}

	/** The child exited, stopped answering, or never started. */
	private async onChildGone(run: ManagedRun, spawnErrorCode: string | null, graceMs?: number): Promise<void> {
		const epoch = run.epoch;
		const wasStarting = run.phase === 'starting';

		if (!(await this.halt(run, graceMs)) || epoch !== this.epoch) {
			return;
		}

		if (spawnErrorCode === 'ENOENT' || spawnErrorCode === 'ENOTDIR') {
			this.update({ mode: 'managed', state: 'unavailable', reason: 'binary_missing', version: null });
		} else if (spawnErrorCode === 'EACCES') {
			this.update({ mode: 'managed', state: 'unavailable', reason: 'binary_not_executable', version: null });
		} else if (wasStarting) {
			await this.classifyStartFailure(epoch, 'crashed');
		} else {
			this.noteFailure(epoch, 'crashed');
		}
	}

	private async refuseForeignListener(run: ManagedRun): Promise<void> {
		const epoch = run.epoch;

		if (!(await this.halt(run)) || epoch !== this.epoch) {
			return;
		}

		this.logger.error('The go2rtc api port is held by another service');
		this.update({ mode: 'managed', state: 'error', reason: 'port_in_use', version: null });
	}

	/**
	 * A child that did not become ready: a service answering on the api port without our credentials means the port
	 * belongs to someone else (no retry); silence means our child failed (counted, retried).
	 */
	private async classifyStartFailure(epoch: number, reason: 'start_timeout' | 'crashed'): Promise<void> {
		const foreign = await this.isForeignListener();

		if (epoch !== this.epoch) {
			return;
		}

		if (foreign) {
			this.logger.error('The go2rtc api port is held by another service');
			this.update({ mode: 'managed', state: 'error', reason: 'port_in_use', version: null });

			return;
		}

		this.noteFailure(epoch, reason);
	}

	private async isForeignListener(): Promise<boolean> {
		const apiPort = getEnvValue<number>(this.nestConfigService, 'FB_GO2RTC_API_PORT', GO2RTC_DEFAULT_API_PORT);

		try {
			await this.createClient({ baseUrl: `http://127.0.0.1:${apiPort}`, authorization: null }).getInfo();

			return true;
		} catch (error) {
			// Any HTTP status, even a 401, proves some service answers; `null` means nothing did.
			return error instanceof Go2rtcApiError && error.status !== null;
		}
	}

	/** Counts a failed attempt and schedules the next spawn, or gives up after the last backoff step. */
	private noteFailure(epoch: number, reason: 'start_timeout' | 'crashed'): void {
		if (epoch !== this.epoch) {
			return;
		}

		this.attempts++;

		if (this.attempts > GO2RTC_RESTART_BACKOFF_MS.length) {
			this.logger.warn(`go2rtc keeps failing reason=${reason}; giving up`);

			for (const line of this.outputTail) {
				this.logger.warn(`go2rtc output: ${line}`);
			}

			this.update({ mode: 'managed', state: 'error', reason, version: null });

			return;
		}

		const delay = GO2RTC_RESTART_BACKOFF_MS[this.attempts - 1];

		this.update({ mode: 'managed', state: 'starting', reason, version: null });

		this.retryTimer = setTimeout(() => {
			this.retryTimer = null;

			void this.withLock(() => {
				if (epoch === this.epoch && this.applied !== null) {
					this.spawnManaged(epoch, this.applied.binaryPath);
				}

				return Promise.resolve();
			}).catch((error: unknown) => {
				this.logger.error(`go2rtc respawn failed error=${errorName(error)}`);
			});
		}, delay);
		this.retryTimer.unref?.();
	}

	/**
	 * Ends the run and stops its child. Resolves `false` when the child could not be confirmed terminated (it stays
	 * owned by the supervisor, so no second child is started next to it).
	 */
	private async halt(run: ManagedRun, graceMs?: number): Promise<boolean> {
		this.endRun(run);

		try {
			await this.processService.stop(graceMs);
		} catch (error) {
			this.logger.error(`go2rtc could not be confirmed stopped error=${errorName(error)}`);

			if (run.epoch === this.epoch) {
				this.update({ mode: 'managed', state: 'error', reason: 'crashed', version: null });
			}

			return false;
		}

		this.removeConfigFiles();

		return true;
	}

	/** Cancels everything the run owns and releases its password. Idempotent. */
	private endRun(run: ManagedRun): void {
		if (run.ended) {
			return;
		}

		// The ring is already redacted; redact once more with the secrets that are still registered, then keep the tail
		// for the give-up log (the next spawn clears the ring, and the password is released below).
		this.outputTail = this.processService
			.getOutputLines()
			.slice(-OUTPUT_TAIL_LINES)
			.map((line) => redactGo2rtcOutput(line, this.secrets.list()));

		run.ended = true;

		if (this.run === run) {
			this.run = null;
		}

		for (const timer of ['pollTimer', 'deadlineTimer', 'stableTimer', 'probeTimer'] as const) {
			this.clearTimer(run, timer);
		}

		run.releaseSecrets();
	}

	private clearTimer(run: ManagedRun, key: 'pollTimer' | 'deadlineTimer' | 'stableTimer' | 'probeTimer'): void {
		const timer = run[key];

		if (timer !== null) {
			clearTimeout(timer);
			run[key] = null;
		}
	}

	private isLive(run: ManagedRun): boolean {
		return !run.ended && this.run === run && run.epoch === this.epoch;
	}

	/** Stops everything, child included, and deletes the config file. Rejects when the child cannot be confirmed gone. */
	private async teardown(): Promise<void> {
		if (this.retryTimer !== null) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}

		if (this.externalTimer !== null) {
			clearTimeout(this.externalTimer);
			this.externalTimer = null;
		}

		this.externalClient = null;

		if (this.run !== null) {
			this.endRun(this.run);
		}

		await this.processService.stop();

		this.removeConfigFiles();
	}

	// ---- config file ----

	private getConfigDir(): string {
		const root = getEnvValue<string>(
			this.nestConfigService,
			'FB_CONFIG_PATH',
			resolve(__dirname, '../../../../../../var/data'),
		);

		return join(resolve(root), GO2RTC_CONFIG_DIRNAME);
	}

	private writeConfigFile(configDir: string, configPath: string, content: string): void {
		mkdirSync(configDir, { recursive: true, mode: 0o700 });
		// `mkdir` leaves the mode of a directory that already exists alone.
		chmodSync(configDir, 0o700);
		// Files left by an earlier crash carry streams and an old password.
		this.removeConfigFiles();
		writeFileSync(configPath, content, { mode: 0o600, flag: 'wx' });
		chmodSync(configPath, 0o600);
	}

	/** Deletes every per-spawn config file in the go2rtc config directory (there is at most one child). */
	private removeConfigFiles(): void {
		const configDir = this.getConfigDir();

		try {
			for (const name of readdirSync(configDir)) {
				if (CONFIG_FILE_PATTERN.test(name)) {
					rmSync(join(configDir, name), { force: true });
				}
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				this.logger.warn(`go2rtc config files could not be removed error=${errorName(error)}`);
			}
		}
	}

	// ---- status ----

	private update(patch: Partial<Omit<Go2rtcRelayStatus, 'generation'>>, bump: boolean = false): void {
		const previous = this.status;
		const next: Go2rtcRelayStatus = { ...previous, ...patch };

		if (bump || next.mode !== previous.mode) {
			next.generation = previous.generation + 1;
		}

		if (
			next.mode === previous.mode &&
			next.state === previous.state &&
			next.reason === previous.reason &&
			next.version === previous.version &&
			next.generation === previous.generation
		) {
			return;
		}

		this.status = next;

		if (next.state !== previous.state || next.reason !== previous.reason) {
			this.logger.log(`go2rtc relay state=${next.state} reason=${next.reason ?? 'none'}`);
		}

		for (const listener of [...this.listeners]) {
			try {
				listener({ ...next });
			} catch (error) {
				this.logger.warn(`go2rtc relay listener failed error=${errorName(error)}`);
			}
		}
	}
}
