import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/installers/linux.ts', import.meta.url), 'utf8');
const preflight = source.match(/private assertNoActivePrivilegedJobs\(\): void \{([\s\S]*?)\n\t\}/);
assert.ok(preflight);

function guard(states, installed = true) {
	let probes = 0;
	const check = vm.runInNewContext(`(function() { ${preflight[1]} })`, {
		existsSync: () => installed,
		execFileSync: (command, args, options) => {
			assert.equal(command, '/usr/bin/systemctl');
			assert.equal(options.timeout, 5000);
			const state = states[probes++];
			if (state instanceof Error) throw state;
			return `${state}\n`;
		},
	});
	check();
	return probes;
}

assert.equal(guard([], false), 0);
assert.equal(guard(['inactive', 'failed', 'inactive']), 3);
for (const state of ['active', 'activating', 'deactivating', 'reloading', '', 'unknown']) {
	assert.throws(() => guard([state]), /uninstall refused/);
}
assert.throws(() => guard([new Error('Manager unavailable')]), /Cannot establish privileged worker state/);

const uninstall = source.slice(source.indexOf('async uninstall('), source.indexOf('\n\tgetInstalledConfig('));
const firstProbe = uninstall.indexOf('this.assertNoActivePrivilegedJobs();');
const stop = uninstall.indexOf("exec('systemctl stop smart-panel'");
const secondProbe = uninstall.indexOf('this.assertNoActivePrivilegedJobs();', firstProbe + 1);
assert.ok(firstProbe >= 0 && firstProbe < stop && stop < secondProbe);
assert.ok(secondProbe < uninstall.indexOf('unlinkSync(SYSTEMD_PATH)'));
assert.ok(secondProbe < uninstall.indexOf('rmSync(dataDir'));
assert.match(uninstall, /'\/etc\/sudoers\.d\/smart-panel'/);
assert.match(uninstall, /'\/etc\/systemd\/system\/smart-panel\.service\.d\/privileged-helper\.conf'/);
assert.doesNotMatch(uninstall, /rmSync\([^\n]*(?:smart-panel-privileged|\/usr\/local\/libexec)/);

console.log('PASS: uninstall refuses active/ambiguous workers before stop and before destructive cleanup');
console.log('PASS: uninstall removes only its policy/drop-in and preserves protected worker evidence/code');
