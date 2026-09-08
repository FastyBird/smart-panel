import { execFile } from 'node:child_process';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import {
	CLOUDFLARED_BINARY,
	CLOUDFLARED_CLI_DEFAULT_TIMEOUT_MS,
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
} from '../remote-access-cloudflare-tunnel.constants';

/** Classified reasons a `cloudflared` CLI invocation can fail. */
export type CloudflaredCliErrorKind = 'not-installed' | 'unknown';

export class CloudflaredCliError extends Error {
	constructor(
		public readonly kind: CloudflaredCliErrorKind,
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = 'CloudflaredCliError';
	}
}

export interface CloudflaredVersionInfo {
	version: string;
	raw: string;
}

interface ExecCloudflaredResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

/** Matches the version number cloudflared prints, e.g. `cloudflared version 2024.6.1 (built ...)`. */
const VERSION_PATTERN = /(\d+\.\d+\.\d+)/;

/**
 * Thin wrapper around the `cloudflared` binary. This plugin's only use of the CLI directly
 * (outside the `cloudflared tunnel ... run` child process itself, owned by
 * `CloudflaredProcessService`) is reading the installed version — every call goes through
 * `execFile` with an argument array, never a shell string.
 */
@Injectable()
export class CloudflaredCliService {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME, 'CloudflaredCliService');

	async getVersion(): Promise<CloudflaredVersionInfo> {
		const { stdout, stderr, exitCode } = await this.exec(['--version']);

		if (exitCode !== 0) {
			const detail = stderr.trim() || stdout.trim();

			throw new CloudflaredCliError(
				'unknown',
				`cloudflared --version exited with code ${exitCode}${detail ? `: ${detail}` : ''}`,
			);
		}

		const match = VERSION_PATTERN.exec(stdout);

		if (!match) {
			throw new CloudflaredCliError(
				'unknown',
				'`cloudflared --version` did not include a recognizable version number.',
			);
		}

		return { version: match[1], raw: stdout.trim() };
	}

	private exec(args: readonly string[]): Promise<ExecCloudflaredResult> {
		const argv = [...args];

		this.logger.debug(`Running: ${CLOUDFLARED_BINARY} ${argv.join(' ')}`);

		return new Promise((resolve, reject) => {
			execFile(CLOUDFLARED_BINARY, argv, { timeout: CLOUDFLARED_CLI_DEFAULT_TIMEOUT_MS }, (error, stdout, stderr) => {
				const out = stdout ?? '';
				const err = stderr ?? '';

				if (error) {
					const nodeError = error as NodeJS.ErrnoException;

					if (nodeError.code === 'ENOENT') {
						this.logger.warn(`cloudflared binary not found: ${CLOUDFLARED_BINARY} ${argv.join(' ')}`);

						reject(
							new CloudflaredCliError('not-installed', 'The cloudflared CLI is not installed or not on PATH.', error),
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
