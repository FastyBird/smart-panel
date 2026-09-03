import { type ChildProcessWithoutNullStreams, execFile, spawn } from 'node:child_process';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import {
	REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
	TAILSCALE_BINARY,
	TAILSCALE_CLI_DEFAULT_TIMEOUT_MS,
} from '../remote-access-tailscale.constants';

/**
 * Classified reasons a `tailscale` CLI invocation can fail. Every call site
 * catches on this instead of parsing raw stderr text again.
 */
export type TailscaleCliErrorKind =
	| 'not-installed'
	| 'permission-denied'
	| 'daemon-down'
	| 'needs-login'
	| 'settings-conflict'
	| 'timeout'
	| 'unknown';

export class TailscaleCliError extends Error {
	constructor(
		public readonly kind: TailscaleCliErrorKind,
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = 'TailscaleCliError';
	}
}

/**
 * `BackendState` values reported by `tailscale status --json`, per the
 * upstream `ipn.State` enum. `InUseOtherUser` is a Windows-only state kept
 * here only so the mapper can classify it defensively.
 */
export type TailscaleBackendState =
	| 'NoState'
	| 'NeedsLogin'
	| 'NeedsMachineAuth'
	| 'Stopped'
	| 'Starting'
	| 'Running'
	| 'InUseOtherUser';

export interface TailscaleSelfStatus {
	HostName?: string;
	/** Fully qualified MagicDNS name, terminated with a trailing dot. */
	DNSName?: string;
	Online?: boolean;
	TailscaleIPs?: string[];
	OS?: string;
	/** ISO 8601 timestamp; absent when the node key never expires. */
	KeyExpiry?: string;
	CapMap?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface TailscaleTailnetStatus {
	Name?: string;
	MagicDNSSuffix?: string;
	MagicDNSEnabled?: boolean;
	[key: string]: unknown;
}

/**
 * Parsed `tailscale status --json` document. The upstream `--json` shape is
 * explicitly documented as subject to change, so only the fields the mapper
 * actually reads are declared — everything else is tolerated and ignored.
 */
export interface TailscaleStatus {
	BackendState: TailscaleBackendState;
	AuthURL?: string;
	TailscaleIPs?: string[];
	Self?: TailscaleSelfStatus;
	Health?: string[];
	CurrentTailnet?: TailscaleTailnetStatus;
	CertDomains?: string[];
	Version?: string;
	[key: string]: unknown;
}

export interface TailscaleVersionInfo {
	version: string;
	raw: Record<string, unknown>;
}

/**
 * Parsed `tailscale serve status --json` document (`tailscale funnel status
 * --json` is registered as the exact same command upstream — confirmed
 * against `cmd/tailscale/cli/serve_v2.go`'s `newServeV2Command`, which wires
 * both the `serve` and `funnel` subcommands to the same `status`/`reset`
 * children — so this plugin only ever calls the `serve` form). Nothing
 * configured prints an empty object. Like `TailscaleStatus`, this is
 * documented upstream as subject to change — only the fields
 * `TailscaleServeService` actually reads are declared, everything else is
 * tolerated and ignored.
 */
export interface TailscaleServeStatus {
	/** Keyed by port (e.g. `"443"`); present when Serve has a TCP handler on that port. */
	TCP?: Record<string, { HTTPS?: boolean; HTTP?: boolean; [key: string]: unknown }>;
	/** Keyed by `host:port`; present when Serve has a web handler configured. */
	Web?: Record<
		string,
		{ Handlers?: Record<string, { Proxy?: string; [key: string]: unknown }>; [key: string]: unknown }
	>;
	/** Keyed by `host:port`, value true when Funnel is allowed/on for that entry. */
	AllowFunnel?: Record<string, boolean>;
	[key: string]: unknown;
}

interface ExecTailscaleResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

/** Flag names carrying an auth key, in either `--flag=value` or `--flag value` form. */
const AUTH_KEY_FLAG_NAMES: ReadonlySet<string> = new Set(['--auth-key', '--authkey']);

/**
 * Redacts an auth-key argument for logging, in both forms `tailscale up`
 * accepts: `--auth-key=value` (or `--authkey=value`) and the flag and value
 * as two separate arguments (`--auth-key value`). A `file:...` value (RA-5's
 * ephemeral-file form) is left visible — it is a path, not the key itself.
 * The real argument array passed to `execFile` is never touched — only the
 * copy handed to the logger goes through this.
 */
export function redactTailscaleArgs(args: readonly string[]): string[] {
	const redacted: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		const equalsIndex = arg.indexOf('=');
		const flagName = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);

		if (!AUTH_KEY_FLAG_NAMES.has(flagName)) {
			redacted.push(arg);

			continue;
		}

		if (equalsIndex === -1) {
			// Separate flag + value pair — the *next* argument is the key,
			// unless it is a `file:...` path (RA-5's ephemeral-file form),
			// which is left visible just like the `--flag=file:...` form.
			redacted.push(arg);

			if (i + 1 < args.length) {
				const nextValue = args[i + 1];

				redacted.push(nextValue.startsWith('file:') ? nextValue : '***redacted***');
				i++;
			}

			continue;
		}

		const value = arg.slice(equalsIndex + 1);

		redacted.push(value.startsWith('file:') ? arg : `${flagName}=***redacted***`);
	}

	return redacted;
}

const SETTINGS_CONFLICT_PATTERN = /must specify all|--reset/i;
const PERMISSION_DENIED_PATTERN = /access denied|permission denied|must be root,? or operator/i;
const DAEMON_DOWN_PATTERN =
	/connection refused|failed to connect to local|couldn't connect|no such file or directory.*sock/i;
const NEEDS_LOGIN_PATTERN = /not logged in|needs to log in|logged out/i;

/**
 * Thin wrapper around the `tailscale` binary. Every call goes through
 * `execFile` with an argument array (never a shell string), a bounded
 * timeout, and classifies failures instead of leaking raw stderr text to
 * callers. Argument logging always redacts `--auth-key`/`--authkey` values
 * (see `redactTailscaleArgs`), even though this plugin never passes one
 * itself yet — the login flow (RA-5) will reuse this wrapper and its keys
 * must never reach a log line.
 */
@Injectable()
export class TailscaleCliService {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'TailscaleCliService');

	async getVersion(): Promise<TailscaleVersionInfo> {
		const { stdout, stderr, exitCode } = await this.exec(['version', '--json']);

		if (exitCode !== 0) {
			throw this.classify(stdout, stderr, `tailscale version --json exited with code ${exitCode}`);
		}

		let parsed: Record<string, unknown>;

		try {
			parsed = JSON.parse(stdout) as Record<string, unknown>;
		} catch (error) {
			throw new TailscaleCliError('unknown', 'Failed to parse `tailscale version --json` output.', error);
		}

		const version = parsed.majorMinorPatch ?? parsed.short ?? parsed.long;

		if (typeof version !== 'string' || version.length === 0) {
			throw new TailscaleCliError(
				'unknown',
				'`tailscale version --json` did not include a recognizable version field.',
			);
		}

		return { version, raw: parsed };
	}

	/**
	 * Real `tailscale status` exits non-zero whenever the backend is not
	 * `Running` (e.g. `NeedsLogin`, `Stopped`) even though it still prints a
	 * fully valid status document to stdout. Parsing is attempted first and
	 * the exit code only matters when parsing fails.
	 */
	async getStatus(): Promise<TailscaleStatus> {
		const { stdout, stderr, exitCode } = await this.exec(['status', '--json']);

		let parsed: Record<string, unknown>;

		try {
			parsed = JSON.parse(stdout) as Record<string, unknown>;
		} catch (parseError) {
			throw this.classify(stdout, stderr, `tailscale status --json exited with code ${exitCode}`, parseError);
		}

		if (typeof parsed.BackendState !== 'string') {
			throw this.classify(stdout, stderr, 'tailscale status --json output did not include a BackendState field');
		}

		return parsed as unknown as TailscaleStatus;
	}

	async up(args: readonly string[]): Promise<void> {
		await this.runManagementCommand(['up', ...args]);
	}

	async set(args: readonly string[]): Promise<void> {
		await this.runManagementCommand(['set', ...args]);
	}

	async down(): Promise<void> {
		await this.runManagementCommand(['down']);
	}

	async logout(): Promise<void> {
		await this.runManagementCommand(['logout']);
	}

	/**
	 * Thin call for the factory-reset hook only — clears every Serve/Funnel
	 * handler on the node, including ones this plugin never created.
	 * `TailscaleServeService.apply()` must never call this; it uses the
	 * scoped `serveOff()` below to remove only its own managed handler.
	 */
	async serveReset(): Promise<void> {
		await this.runManagementCommand(['serve', 'reset']);
	}

	/**
	 * Serves the admin UI over HTTPS on the tailnet only (private), proxying
	 * to the backend listening on `backendPort` at `127.0.0.1`. Always port
	 * 443 and the root path — the plugin never serves any other port or a
	 * sub-path.
	 *
	 * Confirmed against `cmd/tailscale/cli/serve_v2.go`: `setServe()` always
	 * calls `applyFunnel(sc, dnsName, port, allowFunnel)`, and `allowFunnel`
	 * is exactly `subcmd == funnel`. Running the plain `serve` form here
	 * therefore explicitly sets `AllowFunnel[<dnsname>:443] = false` even
	 * when Funnel was previously on for this same handler — this is also how
	 * `TailscaleServeService` downgrades a public handler back to private,
	 * with no separate "funnel off" command.
	 */
	async serve(backendPort: number): Promise<void> {
		await this.runManagementCommand([
			'serve',
			'--bg',
			'--https=443',
			'--set-path=/',
			`http://127.0.0.1:${backendPort}`,
		]);
	}

	/**
	 * Serves the admin UI over HTTPS and publishes it to the public internet
	 * through Funnel, proxying to the same backend `serve()` does. Identical
	 * flags to `serve()` other than the subcommand — `setServe()` builds the
	 * exact same Web/TCP handler either way and only `AllowFunnel` differs
	 * (`true` here). The legacy two-argument form (`tailscale funnel 443
	 * on`) is rejected by current releases with "the CLI for serve and
	 * funnel has changed" (`isLegacyInvocation` in serve_v2.go) — this is the
	 * serve-v2 replacement.
	 */
	async funnelOn(backendPort: number): Promise<void> {
		await this.runManagementCommand([
			'funnel',
			'--bg',
			'--https=443',
			'--set-path=/',
			`http://127.0.0.1:${backendPort}`,
		]);
	}

	/**
	 * Removes the managed Serve/Funnel handler for port 443, root path only —
	 * the serve-v2 scoped form (`unsetServe()` in serve_v2.go), which touches
	 * only this one handler. Deliberately not `serve reset`: reset clears
	 * every handler on the node, including ones this plugin never created.
	 * `serve reset` stays reserved for the factory-reset hook (`serveReset()`
	 * below), which intentionally wants a clean slate.
	 */
	async serveOff(): Promise<void> {
		await this.runManagementCommand(['serve', '--https=443', '--set-path=/', 'off']);
	}

	/**
	 * Read-back for the Serve/Funnel config; `TailscaleServeService` derives
	 * both whether Serve and whether Funnel are active from the parsed
	 * result — `tailscale funnel status --json` is registered as the exact
	 * same command (`Exec: e.runServeStatus` for both the `serve` and
	 * `funnel` subcommands in `newServeV2Command`), so there is no separate
	 * `funnelStatus()` call.
	 */
	async serveStatus(): Promise<TailscaleServeStatus> {
		return this.execServeConfig(['serve', 'status', '--json']);
	}

	/**
	 * Spawns `tailscale up <args>` directly and returns the live child process
	 * handle instead of buffering to completion. The sign-in flows (RA-5) need
	 * this instead of `up()`: the interactive flow reads `--json` output
	 * incrementally as two blocks arrive and keeps the handle to cancel a
	 * pending sign-in, and the auth-key flow needs its own longer, cancellable
	 * timeout instead of the default CLI timeout `up()` applies. Never a shell
	 * string — same argument-array contract as every other call here. Argument
	 * logging redacts `--auth-key=` values exactly like every other command.
	 */
	spawnUp(args: readonly string[]): ChildProcessWithoutNullStreams {
		const argv = ['up', ...args];

		this.logger.debug(`Spawning: ${TAILSCALE_BINARY} ${redactTailscaleArgs(argv).join(' ')}`);

		return spawn(TAILSCALE_BINARY, argv);
	}

	private async runManagementCommand(args: readonly string[]): Promise<void> {
		const { stdout, stderr, exitCode } = await this.exec(args);

		if (exitCode !== 0) {
			throw this.classify(stdout, stderr, `tailscale ${args[0] ?? ''} exited with code ${exitCode}`);
		}
	}

	/** Shared by `serveStatus()`/`funnelStatus()` — both read the same `ipn.ServeConfig` shape; empty stdout means nothing configured. */
	private async execServeConfig(args: readonly string[]): Promise<TailscaleServeStatus> {
		const { stdout, stderr, exitCode } = await this.exec(args);

		if (exitCode !== 0) {
			throw this.classify(stdout, stderr, `tailscale ${args.join(' ')} exited with code ${exitCode}`);
		}

		try {
			return JSON.parse(stdout || '{}') as TailscaleServeStatus;
		} catch (error) {
			throw new TailscaleCliError('unknown', `Failed to parse \`tailscale ${args.join(' ')}\` output.`, error);
		}
	}

	private classify(stdout: string, stderr: string, context: string, cause?: unknown): TailscaleCliError {
		const text = `${stderr}\n${stdout}`;

		let kind: TailscaleCliErrorKind = 'unknown';

		if (SETTINGS_CONFLICT_PATTERN.test(text)) {
			kind = 'settings-conflict';
		} else if (PERMISSION_DENIED_PATTERN.test(text)) {
			kind = 'permission-denied';
		} else if (DAEMON_DOWN_PATTERN.test(text)) {
			kind = 'daemon-down';
		} else if (NEEDS_LOGIN_PATTERN.test(text)) {
			kind = 'needs-login';
		}

		const detail = stderr.trim() || stdout.trim();

		return new TailscaleCliError(kind, detail ? `${context}: ${detail}` : context, cause);
	}

	private exec(
		args: readonly string[],
		timeoutMs: number = TAILSCALE_CLI_DEFAULT_TIMEOUT_MS,
	): Promise<ExecTailscaleResult> {
		const argv = [...args];

		this.logger.debug(`Running: ${TAILSCALE_BINARY} ${redactTailscaleArgs(argv).join(' ')}`);

		return new Promise((resolve, reject) => {
			execFile(TAILSCALE_BINARY, argv, { timeout: timeoutMs }, (error, stdout, stderr) => {
				const out = stdout ?? '';
				const err = stderr ?? '';

				if (error) {
					const nodeError = error as NodeJS.ErrnoException & { killed?: boolean };

					if (nodeError.code === 'ENOENT') {
						this.logger.warn(`tailscale binary not found: ${TAILSCALE_BINARY} ${redactTailscaleArgs(argv).join(' ')}`);

						reject(new TailscaleCliError('not-installed', 'The tailscale CLI is not installed or not on PATH.', error));

						return;
					}

					if (nodeError.killed) {
						this.logger.warn(`tailscale call timed out: ${TAILSCALE_BINARY} ${redactTailscaleArgs(argv).join(' ')}`);

						reject(
							new TailscaleCliError(
								'timeout',
								`tailscale ${argv[0] ?? ''} did not complete within ${timeoutMs}ms.`,
								error,
							),
						);

						return;
					}

					const exitCode = typeof nodeError.code === 'number' ? nodeError.code : -1;

					resolve({ stdout: out, stderr: err, exitCode });

					return;
				}

				resolve({ stdout: out, stderr: err, exitCode: 0 });
			});
		});
	}
}
