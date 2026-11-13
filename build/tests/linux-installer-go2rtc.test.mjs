import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/installers/linux.ts', import.meta.url), 'utf8');
const method = source.match(/private installGo2rtc\(\): void \{([\s\S]*?)\n\t\}/);
assert.ok(method, 'installGo2rtc method not found');

const INSTALLER = '/pkg/node_modules/@fastybird/smart-panel-backend/dist/go2rtc/install-go2rtc.sh';

function run({ installerExists = true, execError = null } = {}) {
	const calls = [];
	const warnings = [];
	const probed = [];
	const fn = vm.runInNewContext(`(function() { ${method[1].replace(/\bthis\./g, 'self.')} })`, {
		self: { packageRoot: '/pkg' },
		join,
		getBackendPath: (base) => join(base, 'node_modules', '@fastybird', 'smart-panel-backend'),
		existsSync: (path) => {
			probed.push(path);
			return installerExists;
		},
		execFileSync: (command, args, options) => {
			calls.push({ command, args, options });
			if (execError) throw execError;
		},
		logger: { warning: (message) => warnings.push(message) },
		GO2RTC_INSTALL_TIMEOUT_MS: 960_000,
		Error,
		String,
	});
	fn();
	return { calls, warnings, probed };
}

test('runs the bundled installer with /bin/sh, no stdin and a timeout', () => {
	const { calls, warnings, probed } = run();

	assert.deepEqual([...probed], [INSTALLER]);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].command, '/bin/sh');
	assert.deepEqual([...calls[0].args], [INSTALLER]);
	assert.equal(calls[0].options.stdio[0], 'ignore');
	assert.equal(calls[0].options.timeout, 960_000);
	assert.equal(calls[0].options.killSignal, 'SIGKILL');
	assert.equal(warnings.length, 0);
});

test('a missing installer is a warning and the install continues', () => {
	const { calls, warnings } = run({ installerExists: false });

	assert.equal(calls.length, 0);
	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /go2rtc installer not found/);
});

test('a failing installer is a warning and does not throw', () => {
	const { calls, warnings } = run({ execError: new Error('Command failed: exit 1') });

	assert.equal(calls.length, 1);
	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /go2rtc installation failed \(Command failed: exit 1\)/);
});

test('a timed out installer is a warning and does not throw', () => {
	const { warnings } = run({
		execError: Object.assign(new Error('spawnSync /bin/sh ETIMEDOUT'), { code: 'ETIMEDOUT' }),
	});

	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /ETIMEDOUT/);
});

test('install() runs the go2rtc step last, after the service start', () => {
	const install = source.slice(source.indexOf('async install('), source.indexOf('async uninstall('));
	const start = install.indexOf('await this.start();');
	const go2rtc = install.indexOf('this.installGo2rtc();');

	assert.ok(start >= 0 && go2rtc > start);
	assert.equal(install.indexOf('this.installGo2rtc();', go2rtc + 1), -1);
});
