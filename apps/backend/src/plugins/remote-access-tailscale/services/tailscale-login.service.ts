import { type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable, OnModuleInit } from '@nestjs/common';
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

import { TailscaleCliError, TailscaleCliService } from './tailscale-cli.service';
import { TailscaleNodeManagedService } from './tailscale-node-managed.service';

export interface TailscaleLoginResult {
	state: RemoteAccessProviderState;
	authUrl?: string;
	qr?: string;
}

interface PendingInteractiveLogin {
	child: ChildProcessWithoutNullStreams;
	buffer: string;
	authUrl?: string;
	qr?: string;
	timeoutHandle: NodeJS.Timeout;
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
export class TailscaleLoginInProgressException extends Error {
	constructor(message: string) {
		super(message);
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
export class TailscaleLoginService implements OnModuleInit {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'TailscaleLoginService');

	private pending: PendingInteractiveLogin | null = null;
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

	async login(authKey?: string): Promise<TailscaleLoginResult> {
		if (authKey) {
			if (this.keyedLoginInFlight) {
				throw new TailscaleLoginInProgressException(
					'A Tailscale sign-in with an auth key is already in progress. Wait for it to finish before retrying.',
				);
			}

			// A keyed sign-in always wins over an interactive one already in
			// flight: cancel it first so at most one `tailscale up` ever runs
			// at a time. An interactive call that arrives while another
			// interactive one is pending takes the other branch below, which
			// intentionally keeps reusing the same pending attempt instead of
			// cancelling it.
			this.stopPendingLogin();

			return this.loginWithAuthKey(authKey);
		}

		if (this.keyedLoginInFlight) {
			throw new TailscaleLoginInProgressException(
				'A Tailscale sign-in with an auth key is currently in progress. Wait for it to finish before starting an interactive sign-in.',
			);
		}

		return this.loginInteractively();
	}

	async logout(): Promise<TailscaleLoginResult> {
		this.stopPendingLogin();

		try {
			await this.cli.logout();
		} catch (error) {
			// Only "nothing to sign out of" is tolerated — the desired end state
			// already holds. A genuine failure (daemon-down, permission-denied,
			// timeout, unknown, ...) propagates so the controller can surface a
			// clear error instead of silently reporting success.
			if (error instanceof TailscaleCliError && error.kind === 'needs-login') {
				this.logger.debug('tailscale logout had nothing to sign out of', { kind: error.kind });
			} else {
				throw error;
			}
		}

		return this.currentStatus();
	}

	async resetPreferences(): Promise<TailscaleLoginResult> {
		// Unlike logout(), there is no TailscaleCliError.kind worth tolerating
		// here — "nothing to reset" is not a meaningful state, so every
		// failure (needs-login included) propagates, consistent with how
		// logout() treats every kind other than needs-login.
		await this.cli.up(['--reset', ...this.buildManagedFlags()]);

		return this.currentStatus();
	}

	/** Read by `StatusController` to fill `auth_url`/`qr` on `GET /status` while a login is pending. */
	getPendingInteractiveAuth(): { authUrl: string; qr?: string } | null {
		if (!this.pending?.authUrl) {
			return null;
		}

		return { authUrl: this.pending.authUrl, qr: this.pending.qr };
	}

	/**
	 * Kills any in-flight interactive sign-in and clears its auth URL/QR.
	 * Called by `logout()`, on the second `up --json` block, and on timeout.
	 * Safe to call when nothing is pending.
	 */
	stopPendingLogin(): void {
		if (!this.pending) {
			return;
		}

		const { child, timeoutHandle } = this.pending;

		clearTimeout(timeoutHandle);
		this.pending = null;

		child.kill('SIGTERM');
	}

	private async loginWithAuthKey(authKey: string): Promise<TailscaleLoginResult> {
		// Set for the whole method body (file write through the up call) so a
		// second login() call — keyed or interactive — arriving before this one
		// finishes rejects instead of racing a second `tailscale up`.
		this.keyedLoginInFlight = true;

		try {
			const keyFilePath = await this.writeAuthKeyFile(authKey);

			try {
				await this.runUpToCompletion(
					[`--auth-key=file:${keyFilePath}`, '--timeout=120s', ...this.buildManagedFlags()],
					TAILSCALE_LOGIN_AUTH_KEY_TIMEOUT_MS,
				);
			} catch (error) {
				// Never rethrown: an invalid/expired key or a timeout still leaves a
				// real status to report (still NeedsLogin) — the caller always gets
				// that back, per the brief's "return the resulting status" contract.
				this.logger.warn('Tailscale auth-key sign-in did not complete successfully', {
					message: error instanceof Error ? error.message : String(error),
				});
			} finally {
				// Every exit path — success, error, timeout — deletes the ephemeral
				// key file. force:true makes this a no-op if it is already gone.
				await rm(keyFilePath, { force: true }).catch(() => undefined);
			}

			return await this.currentStatus();
		} finally {
			this.keyedLoginInFlight = false;
		}
	}

	private loginInteractively(): Promise<TailscaleLoginResult> {
		if (this.pending) {
			// Only one pending login at a time: hand back the URL already in
			// flight instead of spawning a second `up` process.
			return Promise.resolve({ state: 'pending-auth', authUrl: this.pending.authUrl, qr: this.pending.qr });
		}

		const child = this.cli.spawnUp(['--json', '--timeout=10m', ...this.buildManagedFlags()]);

		child.stderr.resume(); // drain — never read, but must not block the pipe

		return new Promise<TailscaleLoginResult>((resolve, reject) => {
			let settled = false;
			let firstBlockSeen = false;

			// Declared as `const` further down (after the deadline it guards is
			// computed) but referenced here: safe because `settleResolve`/
			// `settleReject` are only ever invoked from callbacks that run after
			// this whole synchronous setup — including that declaration — has
			// completed, never during it.
			const settleResolve = (result: TailscaleLoginResult): void => {
				if (settled) {
					return;
				}

				settled = true;
				clearTimeout(firstBlockTimeoutHandle);
				resolve(result);
			};

			const settleReject = (error: Error): void => {
				if (settled) {
					return;
				}

				settled = true;
				clearTimeout(firstBlockTimeoutHandle);
				reject(error);
			};

			const fallbackToCurrentStatus = (): void => {
				this.currentStatus().then(settleResolve).catch(settleReject);
			};

			const timeoutHandle = setTimeout(() => {
				this.logger.warn('Tailscale interactive sign-in timed out after 10 minutes without completing');
				this.stopPendingLogin();
				settleReject(new Error('Tailscale sign-in timed out after 10 minutes.'));
			}, TAILSCALE_LOGIN_INTERACTIVE_TIMEOUT_MS);

			// A pending sign-in must not, by itself, keep the process alive —
			// same convention as the node managed service's own poll timer.
			timeoutHandle.unref?.();

			// A wedged daemon or a slow control-plane round-trip must not hold
			// this HTTP request open for the full 10 minutes above: if the
			// first `tailscale up --json` block has not printed by this
			// deadline, resolve with a URL-less 'pending-auth' and free the
			// request. The child, the 10-minute timeout and `this.pending`
			// (the single-in-flight marker) all keep running exactly as
			// before — once the first block does arrive, it is still stored
			// on `this.pending` below (see `!firstBlockSeen` in the `data`
			// handler) so GET /status picks up the auth URL/QR via
			// getPendingInteractiveAuth().
			const firstBlockTimeoutHandle = setTimeout(() => {
				this.logger.debug(
					'Tailscale interactive sign-in has not printed its first status block yet; resolving pending-auth without a URL, leaving the sign-in running',
				);
				settleResolve({ state: 'pending-auth' });
			}, TAILSCALE_LOGIN_FIRST_BLOCK_TIMEOUT_MS);

			firstBlockTimeoutHandle.unref?.();

			this.pending = { child, buffer: '', timeoutHandle };

			child.stdout.on('data', (chunk: Buffer) => {
				// Ignore stray data from an already-cleared/replaced pending login
				// (e.g. arriving just after stopPendingLogin() killed this child).
				if (this.pending?.child !== child) {
					return;
				}

				this.pending.buffer += chunk.toString('utf8');

				const { objects, rest } = extractJsonObjects(this.pending.buffer);

				this.pending.buffer = rest;

				for (const raw of objects) {
					let parsed: TailscaleUpJsonBlock;

					try {
						parsed = JSON.parse(raw) as TailscaleUpJsonBlock;
					} catch {
						continue; // Never expected from a real `tailscale up --json` — ignored, not fatal.
					}

					if (!firstBlockSeen) {
						firstBlockSeen = true;
						// The request may already have settled via the first-block
						// timeout above — clear it regardless so it can never fire
						// after this point, whether or not it already has.
						clearTimeout(firstBlockTimeoutHandle);

						if (parsed.AuthURL) {
							if (this.pending) {
								this.pending.authUrl = parsed.AuthURL;
								this.pending.qr = parsed.QR;
							}

							settleResolve({ state: 'pending-auth', authUrl: parsed.AuthURL, qr: parsed.QR });
						} else {
							// Already authenticated (or an immediate error) — nothing to
							// wait for; report the real status instead.
							this.stopPendingLogin();
							fallbackToCurrentStatus();
						}
					} else {
						// Second block: sign-in resolved one way or another. The node
						// managed service's own poller picks up the real state on its
						// next tick — this flow's job is only to stop reporting a now
						// stale auth URL/QR.
						this.stopPendingLogin();
					}
				}
			});

			child.once('error', (error) => {
				if (this.pending?.child === child) {
					this.stopPendingLogin();
				}

				settleReject(error instanceof Error ? error : new Error(String(error)));
			});

			child.once('close', () => {
				if (this.pending?.child === child) {
					this.stopPendingLogin();
				}

				if (!settled) {
					fallbackToCurrentStatus();
				}
			});
		});
	}

	private async currentStatus(): Promise<TailscaleLoginResult> {
		const status = await this.nodeManagedService.computeStatus();

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
	private runUpToCompletion(args: string[], timeoutMs: number): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const child = this.cli.spawnUp(args);

			child.stdout.resume(); // drain — not read in this flow, must not block the pipe
			child.stderr.resume();

			let settled = false;

			const timer = setTimeout(() => {
				if (settled) {
					return;
				}

				settled = true;
				child.kill('SIGTERM');
				reject(new Error(`tailscale up did not complete within ${timeoutMs}ms.`));
			}, timeoutMs);

			timer.unref?.();

			child.once('error', (error) => {
				if (settled) {
					return;
				}

				settled = true;
				clearTimeout(timer);
				reject(error instanceof Error ? error : new Error(String(error)));
			});

			child.once('close', (code) => {
				if (settled) {
					return;
				}

				settled = true;
				clearTimeout(timer);

				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`tailscale up exited with code ${code ?? 'null'}.`));
				}
			});
		});
	}
}
