import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { cancellableExecFile } from '../../../common/utils/cancellable-exec.utils';
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

	async getVersion(signal?: AbortSignal): Promise<CloudflaredVersionInfo> {
		const { stdout, stderr, exitCode } = await this.exec(['--version'], signal);

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

	private async exec(args: readonly string[], signal?: AbortSignal): Promise<ExecCloudflaredResult> {
		this.logger.debug(`Running: ${CLOUDFLARED_BINARY} ${args.join(' ')}`);
		try {
			return await cancellableExecFile(CLOUDFLARED_BINARY, args, signal, CLOUDFLARED_CLI_DEFAULT_TIMEOUT_MS);
		} catch (error) {
			signal?.throwIfAborted();
			throw new CloudflaredCliError(
				(error as NodeJS.ErrnoException).code === 'ENOENT' ? 'not-installed' : 'unknown',
				'Failed to read the cloudflared version.',
				error,
			);
		}
	}
}
