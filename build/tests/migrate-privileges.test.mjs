import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const source = readFileSync(new URL('build/bin/smart-panel-service.js', root), 'utf8');
const migration = source.match(/\.command\('migrate-privileges'\)[\s\S]*?\.action\((async \(options\) => \{[\s\S]*?\n\t\})\);/);
assert.ok(migration, 'Root migration action must exist');

async function runMigration(running, provisionFails = false) {
	const calls = [];
	const installer = {
		status: async () => { calls.push('status'); return { running }; },
		getInstalledConfig: () => ({ user: 'smart-panel', dataDir: '/var/lib/smart-panel', port: 3000 }),
		restart: async () => { calls.push('restart'); },
	};
	const action = vm.runInNewContext(`(${migration[1]})`, {
		isRoot: () => true,
		getInstaller: () => installer,
		provisionPrivilegedHelper: () => {
			calls.push('provision');
			if (provisionFails) throw new Error('Provisioning failed');
		},
		logger: { success: () => calls.push('success'), error: () => calls.push('error') },
		process: { exit: () => { calls.push('exit'); throw new Error('CLI exit'); } },
	});
	if (provisionFails) {
		await assert.rejects(action({ installType: 'npm' }), /CLI exit/);
	} else {
		await action({ installType: 'npm' });
	}
	return calls;
}

assert.deepEqual(await runMigration(true), ['status', 'provision', 'restart', 'success']);
assert.deepEqual(await runMigration(false), ['status', 'provision', 'success']);
assert.deepEqual(await runMigration(true, true), ['status', 'provision', 'error', 'exit']);

for (const path of [
	'build/src/installers/linux.ts',
	'build/raspbian/modules/configure/files/smart-panel.service',
	'build/raspbian/stage-smart-panel/02-configure/files/smart-panel.service',
]) {
	const template = readFileSync(new URL(path, root), 'utf8');
	assert.match(template, /^ReadWritePaths=.*\/var\/lib\/smart-panel-privileged/m, fileURLToPath(new URL(path, root)));
}

console.log('PASS: migration restarts only an already-running service after successful provisioning');
console.log('PASS: fresh unit templates permit privileged state writes through the service sandbox');
