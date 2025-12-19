export * from './base.js';
export * from './linux.js';

import { LinuxInstaller } from './linux.js';
import type { BaseInstaller } from './base.js';

/**
 * Get the appropriate installer for the current platform
 */
export function getInstaller(): BaseInstaller {
	const platform = process.platform;

	switch (platform) {
		case 'linux':
			return new LinuxInstaller();
		default:
			throw new Error(`Unsupported platform: ${platform}. Only Linux is currently supported.`);
	}
}
