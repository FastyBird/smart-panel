const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mkdtemp, readFile, readdir, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { prepareArtifacts } = require('../prepare-raspbian-artifacts.cjs');

async function fixture(t) {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'raspbian-artifacts-'));
	t.after(() => rm(directory, { recursive: true, force: true }));
	return directory;
}

for (const variant of ['server', 'aio', 'display']) {
	for (const extension of ['img.xz', 'zip']) {
		test(`renames ${variant} ${extension} and makes its checksum verify the downloaded filename`, async (t) => {
			const directory = await fixture(t);
			const original = `smart-panel-raspbian-${variant}-v1.1.0-alpha.66-arm64.${extension}`;
			const expected = `smart-panel-raspbian-${variant}-1.1.0-alpha.66-arm64.${extension}`;
			const payload = Buffer.from('image fixture\n');
			await writeFile(path.join(directory, original), payload);
			await writeFile(path.join(directory, `${original}.sha256`), 'stale checksum with the former absolute path');

			await prepareArtifacts(directory, '1.1.0-alpha.66', variant);

			assert.deepEqual((await readdir(directory)).sort(), [expected, `${expected}.sha256`]);
			assert.deepEqual(await readFile(path.join(directory, expected)), payload);
			const checksum = await readFile(path.join(directory, `${expected}.sha256`), 'utf8');
			assert.equal(checksum, `${createHash('sha256').update(payload).digest('hex')}  ${expected}\n`);
		});
	}
}

test('refreshes the checksum when a manual image name is already canonical', async (t) => {
	const directory = await fixture(t);
	const name = 'smart-panel-raspbian-server-main-rc1-arm64.img.xz';
	await writeFile(path.join(directory, name), 'image');
	await writeFile(path.join(directory, `${name}.sha256`), 'stale');

	await prepareArtifacts(directory, 'main-rc1', 'server');
	await prepareArtifacts(directory, 'main-rc1', 'server');

	assert.equal(
		await readFile(path.join(directory, `${name}.sha256`), 'utf8'),
		`${createHash('sha256').update('image').digest('hex')}  ${name}\n`,
	);
});

test('rejects ambiguous images without changing either payload', async (t) => {
	const directory = await fixture(t);
	for (const name of ['first', 'second']) {
		await writeFile(path.join(directory, `smart-panel-raspbian-server-${name}-arm64.zip`), name);
	}
	await assert.rejects(prepareArtifacts(directory, '1.1.0-alpha.66', 'server'), /exactly one server image/);
	assert.equal((await readdir(directory)).length, 2);
});
