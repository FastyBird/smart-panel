import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import os from 'os';
import { promisify } from 'util';

import { GenericPlatform } from './generic.platform';

const execFileAsync = promisify(execFile);

export class DockerPlatform extends GenericPlatform {
	async rebootDevice(): Promise<void> {
		this.logger.log('[SYSTEM] Restarting container via Docker API...');

		const containerId = await this.getContainerId();

		if (!containerId) {
			this.logger.warn('Could not determine container ID, falling back to process exit');
			process.exit(1);
		}

		try {
			await execFileAsync('curl', [
				'-s',
				'--unix-socket',
				'/var/run/docker.sock',
				'-X',
				'POST',
				`http://localhost/containers/${containerId}/restart`,
			]);
		} catch (error) {
			this.logger.error(`Docker restart failed: ${(error as Error).message}, falling back to process exit`);
			process.exit(1);
		}
	}

	async powerOffDevice(): Promise<void> {
		this.logger.log('[SYSTEM] Stopping container via Docker API...');

		const containerId = await this.getContainerId();

		if (!containerId) {
			this.logger.warn('Could not determine container ID, falling back to process exit');
			process.exit(0);
		}

		try {
			await execFileAsync('curl', [
				'-s',
				'--unix-socket',
				'/var/run/docker.sock',
				'-X',
				'POST',
				`http://localhost/containers/${containerId}/stop`,
			]);
		} catch (error) {
			this.logger.error(`Docker stop failed: ${(error as Error).message}, falling back to process exit`);
			process.exit(0);
		}
	}

	private async getContainerId(): Promise<string | null> {
		// Try reading from cgroup (works in most Docker setups)
		try {
			const cgroup = await readFile('/proc/self/cgroup', 'utf-8');
			const match = cgroup.match(/docker\/([a-f0-9]{12,64})/);

			if (match) {
				return match[1];
			}
		} catch {
			// cgroup file not available
		}

		// Try the hostname (Docker sets it to the short container ID by default)
		const hostname = os.hostname();

		if (/^[a-f0-9]{12}$/.test(hostname)) {
			return hostname;
		}

		// Try HOSTNAME env var
		if (process.env.HOSTNAME && /^[a-f0-9]{12}$/.test(process.env.HOSTNAME)) {
			return process.env.HOSTNAME;
		}

		return null;
	}
}
