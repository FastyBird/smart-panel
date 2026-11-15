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

const runSync = (t, { tags = [], gitExit = 0 } = {}) => {
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
	const refs = path.join(fixture, 'tag-refs');
	fs.writeFileSync(refs, tags.map((tag) => `${'a'.repeat(40)}\trefs/tags/${tag}\n`).join(''));
	fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\ncat "$GIT_FIXTURE_REFS"\nexit ${gitExit}\n`, { mode: 0o755 });

	const output = path.join(fixture, 'github-output');
	const result = spawnSync(process.execPath, [script, '1.1.0', 'alpha'], {
		cwd: fixture,
		encoding: 'utf8',
		env: {
			...process.env,
			PATH: `${bin}${path.delimiter}${process.env.PATH}`,
			GITHUB_OUTPUT: output,
			GIT_FIXTURE_REFS: refs,
		},
		timeout: 10000,
	});

	return { result, fixture, output };
};

test('selects the highest version across mixed package histories', (t) => {
	const { result, fixture, output } = runSync(t);

	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /Published Version: 1\.1\.0-alpha\.22/);
	assert.equal(JSON.parse(fs.readFileSync(path.join(fixture, 'package.json'), 'utf8')).version, '1.1.0-alpha.22');
	assert.match(fs.readFileSync(output, 'utf8'), /^version=1\.1\.0-alpha\.22$/m);
});

test('advances past tags that were never published to npm and synchronizes every package', (t) => {
	const { result, fixture, output } = runSync(t, {
		tags: ['v1.1.0-alpha.23', 'v1.1.0-alpha.29', 'v1.1.0-alpha.24'],
	});

	assert.equal(result.status, 0, result.stderr);
	for (const relativePath of ['', ...packagePaths]) {
		assert.equal(
			JSON.parse(fs.readFileSync(path.join(fixture, relativePath, 'package.json'), 'utf8')).version,
			'1.1.0-alpha.30',
		);
	}
	assert.match(fs.readFileSync(path.join(fixture, 'apps/panel/pubspec.yaml'), 'utf8'), /^version: 1\.1\.0-alpha\+30$/m);
	assert.match(fs.readFileSync(output, 'utf8'), /^version=1\.1\.0-alpha\.30$/m);
	assert.match(fs.readFileSync(output, 'utf8'), /^buildNumber=30$/m);
});

test('ignores older, unrelated and malformed tags when npm already has a newer version', (t) => {
	const { result, output } = runSync(t, {
		tags: ['v1.1.0-alpha.9', 'v1.1.0-alpha.20', 'v1.1.0-beta.99', 'v1.2.0-alpha.99', 'v1.1.0-alpha.99-extra'],
	});

	assert.equal(result.status, 0, result.stderr);
	assert.match(fs.readFileSync(output, 'utf8'), /^version=1\.1\.0-alpha\.22$/m);
});

test('refuses to change versions when remote tags cannot be read', (t) => {
	const { result, fixture, output } = runSync(t, { gitExit: 128 });

	assert.equal(result.status, 1);
	assert.match(result.stderr, /git ls-remote/);
	for (const relativePath of ['', ...packagePaths]) {
		assert.equal(
			JSON.parse(fs.readFileSync(path.join(fixture, relativePath, 'package.json'), 'utf8')).version,
			'1.1.0-alpha.21',
		);
	}
	assert.equal(fs.existsSync(output), false);
});
