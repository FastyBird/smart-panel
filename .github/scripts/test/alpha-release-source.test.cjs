const assert = require('node:assert/strict');
const fs = require('node:fs');
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
	const pushIndex = sync.run.indexOf('git push');
	assert.ok(pushIndex >= 0, 'version-commit must push before capturing the SHA');
	assert.ok(pushIndex < sync.run.indexOf('git rev-parse HEAD'));
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
