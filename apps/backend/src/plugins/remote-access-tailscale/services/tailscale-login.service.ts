import { type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { createExtensionLogger } from '../../../common/logger';
import { getEnvValue } from '../../../common/utils/config.utils';
import { RemoteAccessProviderState } from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import {
	REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
	TAILSCALE_DATA_SUBDIR,
	TAILSCALE_LOGIN_AUTH_KEY_TIMEOUT_MS,
	TAILSCALE_LOGIN_FIRST_BLOCK_TIMEOUT_MS,
	TAILSCALE_LOGIN_INTERACTIVE_TIMEOUT_MS,
} from '../remote-access-tailscale.constants';
import {
	TailscaleOperationCancelledException,
	TailscaleOperationInProgressException,
	TailscalePluginDisabledException,
	TailscaleRequirementUnsatisfiedException,
} from '../remote-access-tailscale.exceptions';

import { TailscaleCliError, TailscaleCliService } from './tailscale-cli.service';
import { TailscaleNodeManagedService } from './tailscale-node-managed.service';
import {
	TailscaleOperationCoordinatorService,
	TailscaleOperationToken,
} from './tailscale-operation-coordinator.service';

/** `login()`/`logout()`/`resetPreferences()` all refuse unless both of these hold — see `assertActionable()`. */
const ACTIONABLE_REQUIREMENT_CODES = ['operator-granted', 'daemon-active'] as const;

export interface TailscaleLoginResult {
	state: RemoteAccessProviderState;
	authUrl?: string;
	qr?: string;
}

interface PendingInteractiveLogin {
	child: ChildProcessWithoutNullStreams;
	result: Promise<TailscaleLoginResult>;
	authUrl?: string;
	qr?: string;
	cancel: () => void;
}

/** Shape of one JSON block printed by `tailscale up --json`; only these fields are read — see TailscaleCliService's TailscaleStatus for the same "tolerate unknown fields" contract. */
interface TailscaleUpJsonBlock {
	AuthURL?: string;
	QR?: string;
	BackendState?: string;
	Error?: string;
}

/**
 * Extracts every complete top-level JSON object from a buffer that may hold
 * zero, one or more pretty-printed objects back to back — exactly how
 * `tailscale up --json` streams its two status blocks — plus whatever
 * partial text is left over for the next chunk. Tracks string literals
 * (respecting `\"` escapes) while counting braces so a `{`/`}` inside a
 * quoted value (e.g. buried in a future field) is never mistaken for
 * structure.
 */
export function extractJsonObjects(buffer: string): { objects: string[]; rest: string } {
	const objects: string[] = [];

	let depth = 0;
	let inString = false;
	let escaped = false;
	let start = -1;
	let consumedTo = 0;

	for (let i = 0; i < buffer.length; i++) {
		const char = buffer[i];

		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			}

			continue;
		}

		if (char === '"') {
			inString = true;
		} else if (char === '{') {
			if (depth === 0) {
				start = i;
			}

			depth++;
		} else if (char === '}') {
			depth = Math.max(0, depth - 1);

			if (depth === 0 && start !== -1) {
				objects.push(buffer.slice(start, i + 1));
				start = -1;
				consumedTo = i + 1;
			}
		}
	}

	return { objects, rest: buffer.slice(consumedTo) };
}

/**
 * Raised when `login()` is called while another login is already in flight:
 * a second keyed call while a keyed one is running, or an interactive call
 * while a keyed one is running. Distinct from a plain `Error` so the
 * controller can map it to `409 Conflict` instead of a generic 500.
 */
export class TailscaleLoginInProgressException extends TailscaleOperationInProgressException {
	constructor(message: string) {
		super();
		this.message = message;
		this.name = 'TailscaleLoginInProgressException';
	}
}

/** Matches the ephemeral auth-key file name `writeAuthKeyFile()` generates — see `onModuleInit()`. */
const STALE_AUTH_KEY_FILE_PATTERN = /^auth-key-.+\.key$/;

/**
 * Owns Tailscale sign-in, sign-out and preference reset. Both `up` variants
 * go through `TailscaleCliService.spawnUp()` (never the promise-buffered
 * `up()`, which cannot expose a cancellable handle or stream stdout
 * incrementally):
 *
 * - `login(authKey)`: writes the key to an ephemeral `0600` file, runs `up
 *   --auth-key=file:<path> --timeout=120s <flags>` to completion, deletes the
 *   file on every exit path, and returns the resulting status.
 * - `login()`: spawns `up --json --timeout=10m <flags>`, parses the first
 *   printed block for `AuthURL`/`QR`, keeps the child so a second `login()`
 *   call while pending returns the same URL instead of spawning again, and
 *   clears everything on the second block, `stopPendingLogin()`, timeout or
 *   error.
 *
 * At most one `tailscale up` ever runs at a time: `keyedLoginInFlight` marks
 * the keyed path's whole duration (file write through process exit). A
 * keyed call always cancels a pending *interactive* login and proceeds; a
 * keyed call while another keyed one is in flight, or an interactive call
 * while a keyed one is in flight, both reject with
 * `TailscaleLoginInProgressException` instead of spawning a concurrent `up`.
 *
 * The auth key and the auth URL/QR never reach a log line, an event payload
 * or a thrown error message — only this service's in-memory state and the
 * owner/admin-gated REST responses built from it.
 *
 * `onModuleInit()` also unlinks any ephemeral auth-key file left behind by
 * an abnormal exit (SIGKILL, an OOM kill, a service restart) partway
 * through a keyed sign-in — `loginWithAuthKey()`'s `finally` only runs on a
 * normal exit path, so a hard kill can leave the key on disk.
 */
@Injectable()
export class TailscaleLoginService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'TailscaleLoginService');

	private pending: PendingInteractiveLogin | null = null;
	private interactiveRequest: Promise<TailscaleLoginResult> | null = null;
	/** True for the whole duration of loginWithAuthKey() — see the class doc. */
	private keyedLoginInFlight = false;

	constructor(
		private readonly cli: TailscaleCliService,
		private readonly nodeManagedService: TailscaleNodeManagedService,
		private readonly nestConfigService: NestConfigService,
	) {}

	async onModuleInit(): Promise<void> {
		await this.cleanupStaleAuthKeyFiles();
	}

	private get operations(): TailscaleOperationCoordinatorService {
		return this.nodeManagedService.getOperationCoordinator();
	}

	async onModuleDestroy(): Promise<void> {
		await this.nodeManagedService.stop();
	}

	async login(authKey?: string): Promise<TailscaleLoginResult> {
		if (!this.nodeManagedService.getControlState().enabled) {
			throw new TailscalePluginDisabledException();
		}
		if (this.keyedLoginInFlight) {
			throw new TailscaleLoginInProgressException('A Tailscale auth-key sign-in is already in progress.');
		}
		if (!authKey && this.interactiveRequest !== null) {
			return this.interactiveRequest;
		}
		if (authKey) {
			this.keyedLoginInFlight = true;
			try {
				return await (this.interactiveRequest !== null
					? this.operations.interrupt('login', (token) => this.loginWithAuthKey(authKey, token))
					: this.operations.run('login', (token) => this.loginWithAuthKey(authKey, token)));
			} finally {
				this.keyedLoginInFlight = false;
			}
		}
		return this.loginInteractively();
	}

	async logout(): Promise<TailscaleLoginResult> {
		return this.operations.interrupt('logout', async (token) => {
			await this.assertActionable();
			this.operations.assertCurrent(token);
			try {
				await this.cli.logout();
			} catch (error) {
				if (!(error instanceof TailscaleCliError && error.kind === 'needs-login')) {
					throw error;
				}
			}
			this.operations.assertCurrent(token);
			this.nodeManagedService.clearAuthentication();
			return this.currentStatus();
		});
	}

	async resetPreferences(): Promise<TailscaleLoginResult> {
		if (!this.nodeManagedService.getControlState().enabled) {
			throw new TailscalePluginDisabledException();
		}
		return this.operations.interrupt('preferences', async (token) => {
			await this.assertActionable();
			this.operations.assertCurrent(token);
			await this.nodeManagedService.ensureSupervisorStartedForLogin();
			this.operations.assertCurrent(token);
			await this.cli.up(['--reset', ...this.buildManagedFlags()]);
			this.operations.assertCurrent(token);
			return this.currentStatus();
		});
	}

	private async assertActionable(): Promise<void> {
		const requirements = await this.nodeManagedService.refreshRequirements('status-read');
		this.operations.assertCurrent();
		for (const code of ACTIONABLE_REQUIREMENT_CODES) {
			const requirement = requirements.find((candidate) => candidate.code === code);
			if (requirement && !requirement.satisfied) {
				throw new TailscaleRequirementUnsatisfiedException(requirement);
			}
		}
	}

	getPendingInteractiveAuth(): { authUrl: string; qr?: string } | null {
		return this.pending?.authUrl ? { authUrl: this.pending.authUrl, qr: this.pending.qr } : null;
	}

	stopPendingLogin(): void {
		this.pending?.cancel();
	}

	private async prepareLogin(token: TailscaleOperationToken): Promise<void> {
		await this.assertActionable();
		this.operations.assertCurrent(token);
		// Authentication is also a connection request: start a stopped supervisor.
		await this.nodeManagedService.ensureSupervisorStartedForLogin();
		this.operations.assertCurrent(token);
	}

	private async loginWithAuthKey(authKey: string, token: TailscaleOperationToken): Promise<TailscaleLoginResult> {
		await this.prepareLogin(token);
		const keyFilePath = await this.writeAuthKeyFile(authKey);
		try {
			this.operations.assertCurrent(token);
			try {
				await this.runUpToCompletion(
					[`--auth-key=file:${keyFilePath}`, '--timeout=120s', ...this.buildManagedFlags()],
					TAILSCALE_LOGIN_AUTH_KEY_TIMEOUT_MS,
					token,
				);
			} catch {
				this.operations.assertCurrent(token);
				this.logger.warn('Tailscale auth-key sign-in did not complete successfully');
			}
			this.operations.assertCurrent(token);
			return await this.currentStatus();
		} finally {
			await rm(keyFilePath, { force: true }).catch(() => undefined);
		}
	}

	private loginInteractively(): Promise<TailscaleLoginResult> {
		let resolveResult: (result: TailscaleLoginResult) => void;
		let rejectResult: (error: unknown) => void;
		const result = new Promise<TailscaleLoginResult>((resolve, reject) => {
			resolveResult = resolve;
			rejectResult = reject;
		});
		this.interactiveRequest = result;
		void this.operations
			.run('login', async (token) => {
				await this.prepareLogin(token);
				const child = this.cli.spawnUp(['--json', '--timeout=10m', ...this.buildManagedFlags()]);
				const closed = this.operations.trackChild(child);
				child.stderr.resume();
				let buffer = '';
				let firstBlockSeen = false;
				let cancelled = false;
				const clear = (): void => {
					clearTimeout(timer);
					clearTimeout(firstTimer);
					token.signal.removeEventListener('abort', cancel);
					if (this.pending?.child === child) {
						this.pending = null;
					}
					if (this.interactiveRequest === result) {
						this.interactiveRequest = null;
					}
				};
				const cancel = (): void => {
					cancelled = true;
					clear();
					rejectResult(new TailscaleOperationCancelledException());
					void this.operations.terminateChild(child).catch(() => undefined);
				};
				token.signal.addEventListener('abort', cancel, { once: true });
				this.pending = { child, result, cancel };
				const timer = setTimeout(() => {
					cancel();
				}, TAILSCALE_LOGIN_INTERACTIVE_TIMEOUT_MS);
				timer.unref?.();
				const firstTimer = setTimeout(() => {
					resolveResult({ state: 'pending-auth' });
				}, TAILSCALE_LOGIN_FIRST_BLOCK_TIMEOUT_MS);
				firstTimer.unref?.();
				child.stdout.on('data', (chunk: Buffer) => {
					if (this.pending?.child !== child || token.signal.aborted) {
						return;
					}
					buffer += chunk.toString('utf8');
					const { objects, rest } = extractJsonObjects(buffer);
					buffer = rest;
					for (const raw of objects) {
						let block: TailscaleUpJsonBlock;
						try {
							block = JSON.parse(raw) as TailscaleUpJsonBlock;
						} catch {
							continue;
						}
						if (!firstBlockSeen && block.AuthURL) {
							firstBlockSeen = true;
							clearTimeout(firstTimer);
							if (this.pending?.child === child) {
								this.pending.authUrl = block.AuthURL;
								this.pending.qr = block.QR;
							}
							resolveResult({ state: 'pending-auth', authUrl: block.AuthURL, qr: block.QR });
						} else {
							clear();
							if (block.Error) {
								cancelled = true;
								rejectResult(new Error(block.Error.replace(/https?:\/\/\S+/gi, '[redacted URL]')));
							}
							void this.operations.terminateChild(child).catch(rejectResult);
						}
					}
				});
				child.once('error', () => {
					cancelled = true;
					clear();
					rejectResult(new Error('The Tailscale sign-in command failed to start.'));
				});
				try {
					await closed;
					this.operations.assertCurrent(token);
					if (!cancelled) {
						resolveResult(await this.currentStatus());
					}
				} finally {
					clear();
				}
			})
			.catch(rejectResult)
			.finally(() => {
				if (this.interactiveRequest === result) {
					this.interactiveRequest = null;
				}
			});
		return result;
	}

	private async currentStatus(): Promise<TailscaleLoginResult> {
		this.operations.assertCurrent();
		const status = await this.nodeManagedService.computeStatus();
		this.operations.assertCurrent();
		return { state: status.state };
	}

	private buildManagedFlags(): string[] {
		const config = this.nodeManagedService.getPluginConfig();

		return this.nodeManagedService.buildUpFlags(config);
	}

	/** Directory holding this plugin's on-disk state — see `TAILSCALE_DATA_SUBDIR`'s own doc. */
	private authKeyDataDir(): string {
		const dataDir = getEnvValue<string>(this.nestConfigService, 'FB_DATA_DIR', '/var/lib/smart-panel');

		return join(dataDir, TAILSCALE_DATA_SUBDIR);
	}

	/**
	 * Unlinks any `auth-key-*.key` file already sitting in the data
	 * directory at boot — left behind by a SIGKILL, an OOM kill or a service
	 * restart that interrupted `loginWithAuthKey()` before its `finally`
	 * could remove it (see the class doc). A missing directory (nothing has
	 * ever attempted a keyed login) is not an error. Never throws — a
	 * best-effort cleanup must not block startup. Only the file name is ever
	 * logged, never its contents.
	 */
	private async cleanupStaleAuthKeyFiles(): Promise<void> {
		const dir = this.authKeyDataDir();

		let entries: string[];

		try {
			entries = await readdir(dir);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				this.logger.debug('Failed to scan the remote-access data directory for stale auth-key files', {
					message: error instanceof Error ? error.message : String(error),
				});
			}

			return;
		}

		for (const entry of entries) {
			if (!STALE_AUTH_KEY_FILE_PATTERN.test(entry)) {
				continue;
			}

			try {
				await rm(join(dir, entry), { force: true });

				this.logger.debug(`Removed a stale Tailscale auth-key file left behind by an abnormal exit: ${entry}`);
			} catch (error) {
				this.logger.debug(`Failed to remove a stale Tailscale auth-key file: ${entry}`, {
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}

	private async writeAuthKeyFile(authKey: string): Promise<string> {
		const dir = this.authKeyDataDir();

		await mkdir(dir, { recursive: true, mode: 0o700 });

		const filePath = join(dir, `auth-key-${randomUUID()}.key`);

		try {
			// Mode set on creation, not chmod'd after — the key is never briefly
			// world/group-readable on disk.
			await writeFile(filePath, authKey, { mode: 0o600 });
		} catch (error) {
			// writeFile can throw after the file already exists on disk (e.g. a
			// write error partway through) — the caller's own finally only
			// covers exit paths after this method has already returned a path,
			// so a partial write is cleaned up right here instead of leaking a
			// key-bearing file with no owner.
			await rm(filePath, { force: true }).catch(() => undefined);

			throw error;
		}

		return filePath;
	}

	/** Runs a spawned `up` to completion without interpreting its output — used by the auth-key flow, which never passes `--json`. */
	private async runUpToCompletion(args: string[], timeoutMs: number, token: TailscaleOperationToken): Promise<void> {
		this.operations.assertCurrent(token);
		const child = this.cli.spawnUp(args);
		const closed = this.operations.trackChild(child);
		child.stdout.resume();
		child.stderr.resume();
		let timeout: NodeJS.Timeout;
		let onAbort: () => void;
		const outcome = new Promise<void>((resolve, reject) => {
			onAbort = () => reject(new TailscaleOperationCancelledException());
			token.signal.addEventListener('abort', onAbort, { once: true });
			timeout = setTimeout(() => {
				void this.operations
					.terminateChild(child)
					.then(() => reject(new Error('Tailscale sign-in timed out.')), reject);
			}, timeoutMs);
			timeout.unref?.();
			child.once('error', () => reject(new Error('The Tailscale sign-in command failed to start.')));
			child.once('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error('The Tailscale sign-in command failed.'));
				}
			});
		});
		try {
			await outcome;
		} finally {
			clearTimeout(timeout);
			token.signal.removeEventListener('abort', onAbort);
			// Cancellation cannot release ownership until the process has been reaped.
			await this.operations.terminateChild(child);
			await closed;
		}
	}
}
