import { lstatSync } from 'fs';

export const PRIVILEGED_HELPER_PATH = '/usr/local/libexec/smart-panel/helper';
export const PRIVILEGED_STATE_DIR = '/var/lib/smart-panel-privileged';
export type PrivilegedOperation = 'update' | 'tailscale-setup' | 'cloudflared-setup';

export const PRIVILEGED_OPERATIONS: Record<PrivilegedOperation, { unit: string; statusFile: string }> = {
	update: { unit: 'smart-panel-update', statusFile: `${PRIVILEGED_STATE_DIR}/update-status.json` },
	'tailscale-setup': {
		unit: 'smart-panel-remote-access',
		statusFile: `${PRIVILEGED_STATE_DIR}/tailscale-setup-status.json`,
	},
	'cloudflared-setup': {
		unit: 'smart-panel-remote-access-cloudflare',
		statusFile: `${PRIVILEGED_STATE_DIR}/cloudflare-tunnel-setup-status.json`,
	},
};

/** A broken link or unreadable installation is present and must never enable legacy sudo. */
export function privilegedHelperPresent(): boolean {
	try {
		lstatSync(PRIVILEGED_HELPER_PATH);

		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code !== 'ENOENT';
	}
}
