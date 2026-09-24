const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const script = path.resolve(__dirname, '../monorepo-version-sync.js');
const packagePaths = [
	'apps/admin',
	'apps/backend',
	'apps/website',
	'packages/example-extension',
	'packages/extension-sdk',
	'build',
];

test('selects the highest version across mixed package histories', (t) => {
	const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-panel-version-sync-'));
	t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));

	for (const relativePath of packagePaths) {
		const directory = path.join(fixture, relativePath);
		fs.mkdirSync(directory, { recursive: true });
		fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ version: '1.1.0-alpha.21' }));
	}
	fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ version: '1.1.0-alpha.21' }));
	fs.mkdirSync(path.join(fixture, 'apps/panel'), { recursive: true });
	fs.writeFileSync(path.join(fixture, 'apps/panel/pubspec.yaml'), 'version: 1.1.0-alpha+21\n');

	const bin = path.join(fixture, 'bin');
	fs.mkdirSync(bin);
	fs.writeFileSync(
		path.join(bin, 'npm'),
		`#!/bin/sh
case "$2" in
  @fastybird/smart-panel-admin|@fastybird/smart-panel-backend|@fastybird/smart-panel-extension-sdk)
    printf '%s\\n' '["1.1.0-alpha.20","1.1.0-alpha.21"]' ;;
  @fastybird/smart-panel)
    printf '%s\\n' '["1.1.0-alpha.20"]' ;;
  *) exit 2 ;;
esac
`,
		{ mode: 0o755 },
	);

	const output = path.join(fixture, 'github-output');
	const result = spawnSync(process.execPath, [script, '1.1.0', 'alpha'], {
		cwd: fixture,
		encoding: 'utf8',
		env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, GITHUB_OUTPUT: output },
		timeout: 10000,
	});

	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /Published Version: 1\.1\.0-alpha\.22/);
	assert.equal(JSON.parse(fs.readFileSync(path.join(fixture, 'package.json'), 'utf8')).version, '1.1.0-alpha.22');
	assert.match(fs.readFileSync(output, 'utf8'), /^version=1\.1\.0-alpha\.22$/m);
});
