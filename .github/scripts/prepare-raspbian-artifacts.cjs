const { createHash } = require('node:crypto');
const { createReadStream } = require('node:fs');
const { readdir, rename, rm, writeFile } = require('node:fs/promises');
const path = require('node:path');

async function prepareArtifacts(directory, version, variant) {
	if (
		typeof version !== 'string' ||
		!/^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/.test(version) ||
		!['server', 'aio', 'display'].includes(variant)
	) {
		throw new Error('Expected a filename-safe version and a server, aio or display variant');
	}

	const prefix = `smart-panel-raspbian-${variant}-`;
	const images = (await readdir(directory)).filter(
		(name) => name.startsWith(prefix) && /-arm64\.(img\.xz|zip)$/.test(name),
	);
	if (images.length !== 1) {
		throw new Error(`Expected exactly one ${variant} image; found ${images.length}`);
	}

	const original = images[0];
	const extension = original.endsWith('.img.xz') ? 'img.xz' : 'zip';
	const filename = `${prefix}${version}-arm64.${extension}`;
	const destination = path.join(directory, filename);
	if (original !== filename) {
		await rename(path.join(directory, original), destination);
		await rm(path.join(directory, `${original}.sha256`), { force: true });
	}

	const hash = createHash('sha256');
	for await (const chunk of createReadStream(destination)) {
		hash.update(chunk);
	}
	await writeFile(`${destination}.sha256`, `${hash.digest('hex')}  ${filename}\n`);
	return filename;
}

module.exports = { prepareArtifacts };

if (require.main === module) {
	prepareArtifacts(...process.argv.slice(2))
		.then(console.log)
		.catch((error) => {
			console.error(error.message);
			process.exitCode = 1;
		});
}
