import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/install-server.sh', import.meta.url));
const sandboxes = [];

after(() => {
	for (const dir of sandboxes) {
		rmSync(dir, { recursive: true, force: true });
	}
});

const INSTALLER_RELATIVE =
	'@fastybird/smart-panel/node_modules/@fastybird/smart-panel-backend/dist/go2rtc/install-go2rtc.sh';

// Single-quotes a value for a generated shell script; an apostrophe in a path must not end the literal.
const shq = (value) => "'" + String(value).replaceAll("'", "'\\''") + "'";

// Extract the two functions under test from the real script and run them with stubbed helpers.
const run = ({ installerExit = null, skip = false, markerExists = false } = {}) => {
	const sandbox = mkdtempSync(join(tmpdir(), 'install-server-go2rtc-'));

	sandboxes.push(sandbox);

	const globalRoot = join(sandbox, 'global');
	const installer = join(globalRoot, INSTALLER_RELATIVE);
	const argsFile = join(sandbox, 'installer-args');
	const marker = join(sandbox, 'etc', 'go2rtc.skip');
	const bin = join(sandbox, 'bin');
	const funcs = join(sandbox, 'funcs.sh');
	const driver = join(sandbox, 'driver.sh');

	mkdirSync(bin);
	writeFileSync(join(bin, 'npm'), `#!/bin/sh\n[ "$1 $2" = "root -g" ] && echo ${shq(globalRoot)}\n`);
	chmodSync(join(bin, 'npm'), 0o755);

	if (installerExit !== null) {
		mkdirSync(join(installer, '..'), { recursive: true });
		writeFileSync(
			installer,
			`#!/bin/sh\necho "ran: $*" > ${shq(argsFile)}\nenv | grep -c '^FB_SKIP_GO2RTC=' >> ${shq(argsFile)} || true\nexit ${installerExit}\n`,
		);
		chmodSync(installer, 0o755);
	}

	if (markerExists) {
		mkdirSync(join(sandbox, 'etc'));
		writeFileSync(marker, 'keep-me');
	}

	const source = readFileSync(script, 'utf8');
	const extract = (name) => {
		const match = source.match(new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?^\\}\\n`, 'm'));

		assert.ok(match, `${name} is defined in install-server.sh`);

		return match[0];
	};

	writeFileSync(funcs, `${extract('find_go2rtc_installer')}\n${extract('install_go2rtc')}\n`);
	writeFileSync(
		driver,
		[
			'set -e',
			'print_step() { echo "STEP: $*"; }',
			'print_success() { echo "OK: $*"; }',
			'print_warning() { echo "WARN: $*"; }',
			`SKIP_GO2RTC=${skip}`,
			`source ${shq(funcs)}`,
			'install_go2rtc',
			'echo "returned"',
		].join('\n'),
	);

	const env = { PATH: `${bin}:/usr/bin:/bin`, FB_GO2RTC_SKIP_FILE: marker };
	const result = spawnSync('bash', [driver], { env, encoding: 'utf8' });

	return {
		...result,
		out: `${result.stdout}${result.stderr}`,
		marker,
		argsFile,
		ran: existsSync(argsFile),
	};
};

test('runs the installer shipped in the installed package', () => {
	const r = run({ installerExit: 0 });

	assert.equal(r.status, 0, r.out);
	assert.ok(r.ran, 'the packaged installer ran');
	assert.equal(readFileSync(r.argsFile, 'utf8').split('\n')[0], 'ran: ');
	assert.match(r.out, /returned/);
});

test('warns and continues when the installed release has no installer', () => {
	const r = run();

	assert.equal(r.status, 0, r.out);
	assert.match(r.out, /WARN:.*does not bundle go2rtc/);
	assert.match(r.out, /returned/);
});

test('continues when the installer fails', () => {
	const r = run({ installerExit: 7 });

	assert.equal(r.status, 0, r.out);
	assert.ok(r.ran, 'the installer ran');
	assert.match(r.out, /WARN:/);
	assert.match(r.out, /returned/);
});

test('--skip-go2rtc writes the marker and does not run the installer', () => {
	const r = run({ installerExit: 0, skip: true });

	assert.equal(r.status, 0, r.out);
	assert.ok(existsSync(r.marker), 'the skip marker was written');
	assert.equal(r.ran, false, 'the installer did not run');
	assert.match(r.out, /STEP:.*skipped/i);
});

test('--skip-go2rtc leaves the content of an existing marker alone', () => {
	const r = run({ installerExit: 0, skip: true, markerExists: true });

	assert.equal(r.status, 0, r.out);
	assert.equal(readFileSync(r.marker, 'utf8'), 'keep-me');
	assert.equal(r.ran, false, 'the installer did not run');
});

test('without --skip-go2rtc the installer is run without FB_SKIP_GO2RTC set, even next to a marker', () => {
	const r = run({ installerExit: 0, markerExists: true });

	assert.equal(r.status, 0, r.out);
	assert.ok(r.ran, 'the installer ran (it decides on the marker itself)');
	assert.equal(readFileSync(r.argsFile, 'utf8').split('\n')[1], '0');
	assert.equal(readFileSync(r.marker, 'utf8'), 'keep-me');
});
