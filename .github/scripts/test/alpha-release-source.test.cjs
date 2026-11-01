const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { parse } = require(
	require.resolve('yaml', {
		paths: [path.resolve(__dirname, '../../../apps/backend')],
	}),
);

const workflow = parse(fs.readFileSync(path.resolve(__dirname, '../../workflows/alpha-release.yml'), 'utf8'));
const source = '${{ needs.sync-versions.outputs.source_sha }}';

test('every alpha publisher and builder consumes the immutable post-version-sync source', () => {
	assert.equal(workflow.jobs['sync-versions'].outputs.source_sha, '${{ steps.version-commit.outputs.sha }}');
	assert.equal(workflow.jobs['sync-versions'].outputs.buildNumber, '${{ steps.set-version.outputs.buildNumber }}');
	const sync = workflow.jobs['sync-versions'].steps.find((step) => step.id === 'version-commit');
	assert.match(sync.run, /sha=\$\(git rev-parse HEAD\)/);
	const checkouts = [];
	for (const [name, job] of Object.entries(workflow.jobs)) {
		if (name === 'sync-versions') continue;
		for (const step of job.steps ?? []) {
			assert.doesNotMatch(step.run ?? '', /git pull/);
			if (step.uses?.startsWith('actions/checkout@')) {
				assert.equal(step.with.ref, source, name);
				checkouts.push(name);
			}
		}
	}
	assert.equal(checkouts.length, 10);
	for (const required of [
		'publish-extension-sdk',
		'publish-backend',
		'publish-admin',
		'publish-main-package',
		'build-display',
		'build-android',
		'build-linux-desktop',
		'build-application',
		'pre-release-alpha',
	]) {
		assert.ok(checkouts.includes(required), required);
	}
});

test('version synchronization exports a published commit with and without version changes', () => {
	const sync = workflow.jobs['sync-versions'].steps.find((step) => step.id === 'version-commit');
	const originalSha = '1'.repeat(40);
	const versionSha = '2'.repeat(40);
	// Bash executes the original control flow; Git only updates local in-memory commit/publication state.
	const git = `
current="$ORIGINAL_SHA"
published="$ORIGINAL_SHA"
git() {
  case "$1" in
    config|add) ;;
    status)
      if [ "$VERSION_CHANGED" = 1 ]; then printf ' M package.json\\n'; fi
      ;;
    commit) current="$VERSION_SHA" ;;
    push) published="$current" ;;
    rev-parse)
      if [ "$current" != "$published" ]; then
        printf 'SHA capture precedes publication\\n' >&2
        return 1
      fi
      printf '%s\\n' "$current"
      ;;
    *) return 127 ;;
  esac
}
`;
	for (const changed of ['1', '0']) {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-source-'));
		const output = path.join(directory, 'output');
		try {
			const result = spawnSync('/bin/bash', ['--noprofile', '--norc', '-euo', 'pipefail', '-c', git + sync.run], {
				cwd: directory,
				encoding: 'utf8',
				timeout: 5_000,
				env: {
					PATH: directory,
					GITHUB_OUTPUT: output,
					ORIGINAL_SHA: originalSha,
					VERSION_SHA: versionSha,
					VERSION_CHANGED: changed,
				},
			});
			assert.ifError(result.error);
			assert.equal(result.status, 0, result.stderr);
			assert.equal(fs.readFileSync(output, 'utf8').trim(), `sha=${changed === '1' ? versionSha : originalSha}`);
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	}
});

test('the alpha tag and version asset name the same source used to build the payloads', () => {
	const steps = workflow.jobs['pre-release-alpha'].steps;
	const release = steps.find((step) => step.uses?.startsWith('softprops/action-gh-release@'));
	assert.equal(release.with.target_commitish, source);
	assert.equal(release.with.tag_name, 'v${{ needs.sync-versions.outputs.version }}');
	const metadata = steps.find((step) => step.name === 'Generate version.json');
	assert.equal(metadata.env.RELEASE_SOURCE_SHA, source);
	assert.match(metadata.run, /RELEASE_SOURCE_SHA:0:7/);
	assert.doesNotMatch(metadata.run, /GITHUB_SHA/);
});
