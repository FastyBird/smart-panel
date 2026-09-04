import { type ExecFileSyncOptions, execFileSync } from 'child_process';

export function printStep(msg: string): void {
	console.log(`  \x1b[34m→\x1b[0m ${msg}`);
}

export function printSuccess(msg: string): void {
	console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}

export function printWarning(msg: string): void {
	console.log(`  \x1b[33m!\x1b[0m ${msg}`);
}

export function printError(msg: string): void {
	console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
}

/**
 * Run a command that needs root, falling back to sudo when the direct call is refused.
 *
 * The Raspbian image grants the `smart-panel` service user passwordless sudo for exactly the
 * command lines the updaters need — see `/etc/sudoers.d/smart-panel`, which spells out
 * `systemctl stop|start|restart smart-panel`, the `ln -sfn` symlink switch and the recursive
 * `chown`. Those grants were dead configuration: the updaters invoked the commands bare, so sudo
 * was never consulted and, because `smart-panel-cli` always runs as that unprivileged user, every
 * privileged step degraded to a warning. An image update reported success having neither stopped
 * nor restarted the service, leaving the old process running against the new symlink.
 *
 * Direct first, sudo second, so a host where the direct call already works — an npm install
 * updating as root, or a container with no sudo at all — behaves exactly as it did before.
 * `-n` keeps a host whose sudoers entry is missing failing immediately rather than blocking on a
 * password prompt with no terminal to answer it.
 */
export function runPrivileged(command: string, args: string[], options: ExecFileSyncOptions): void {
	try {
		execFileSync(command, args, options);

		return;
	} catch (error) {
		// Already root: sudo cannot turn a genuine failure into a success, so report the real one
		// rather than burying it behind a second, more confusing failure.
		if (process.getuid?.() === 0) {
			throw error;
		}
	}

	execFileSync('sudo', ['-n', command, ...args], options);
}
