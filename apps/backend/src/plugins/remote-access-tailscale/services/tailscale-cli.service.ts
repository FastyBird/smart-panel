import { execFile } from 'node:child_process';

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

interface ExecTailscaleResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

/**
 * Redacts an `--auth-key=...` argument value for logging. The real argument
 * array passed to `execFile` is never touched — only the copy handed to the
 * logger goes through this.
 */
export function redactTailscaleArgs(args: readonly string[]): string[] {
	return args.map((arg) => (arg.startsWith('--auth-key=') ? '--auth-key=***redacted***' : arg));
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
 * callers. Argument logging always redacts `--auth-key=` values, even though
 * this plugin never passes one itself yet — the login flow (RA-5) will reuse
 * this wrapper and its keys must never reach a log line.
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

	/** Thin call for the factory-reset hook; RA-6 owns the full serve configuration. */
	async serveReset(): Promise<void> {
		await this.runManagementCommand(['serve', 'reset']);
	}

	private async runManagementCommand(args: readonly string[]): Promise<void> {
		const { stdout, stderr, exitCode } = await this.exec(args);

		if (exitCode !== 0) {
			throw this.classify(stdout, stderr, `tailscale ${args[0] ?? ''} exited with code ${exitCode}`);
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
