const assert = require('node:assert/strict');
const { mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const { tmpdir } = require('node:os');
const test = require('node:test');

const scriptPath = join(__dirname, '..', 'wait-for-visibility.sh');

test('waits through delayed registry visibility', async () => {
	const testRoot = await mkdtemp(join(tmpdir(), 'publish-visibility-'));
	await writeFile(join(testRoot, 'attempts'), '0');
	const npmPath = join(testRoot, 'bin', 'npm');
	await mkdir(join(testRoot, 'bin'));
	await writeFile(
		npmPath,
		`#!/usr/bin/env bash
count=$(( $(cat "${join(testRoot, 'attempts')}") + 1 ))
echo "$count" > "${join(testRoot, 'attempts')}"
if [ "$count" -ge 3 ]; then exit 0; fi
exit 1
`,
		{ mode: 0o755 },
	);

	const result = await new Promise((resolve) => {
		const child = spawn(scriptPath, ['@scope/package', '1.2.3-alpha.9', 'https://registry.example'], {
			env: { ...process.env, PATH: `${join(testRoot, 'bin')}:${process.env.PATH}`, MAX_ATTEMPTS: '3', SLEEP_SECONDS: '0' },
		});
		let output = '';
		child.stdout.on('data', (chunk) => (output += chunk));
		child.on('close', (code) => resolve({ code, output }));
	});

	assert.equal(result.code, 0);
	assert.match(result.output, /visible on https:\/\/registry\.example/);
	assert.equal(await readFile(join(testRoot, 'attempts'), 'utf8'), '3\n');
	await rm(testRoot, { recursive: true, force: true });
});

test('fails after the bounded visibility window', async () => {
	const testRoot = await mkdtemp(join(tmpdir(), 'publish-visibility-'));
	await mkdir(join(testRoot, 'bin'));
	await writeFile(join(testRoot, 'attempts'), '0');
	await writeFile(
		join(testRoot, 'bin', 'npm'),
		`#!/usr/bin/env bash
count=$(( $(cat "${join(testRoot, 'attempts')}") + 1 ))
echo "$count" > "${join(testRoot, 'attempts')}"
exit 1
`,
		{ mode: 0o755 },
	);

	const result = await new Promise((resolve) => {
		const child = spawn(scriptPath, ['@scope/package', '1.2.3-alpha.9', 'https://registry.example'], {
			env: { ...process.env, PATH: `${join(testRoot, 'bin')}:${process.env.PATH}`, SLEEP_SECONDS: '0' },
		});
		let output = '';
		child.stdout.on('data', (chunk) => (output += chunk));
		child.on('close', (code) => resolve({ code, output }));
	});

	assert.equal(result.code, 1);
	assert.match(result.output, /after 90 attempts/);
	assert.equal(await readFile(join(testRoot, 'attempts'), 'utf8'), '90\n');
	await rm(testRoot, { recursive: true, force: true });
});
