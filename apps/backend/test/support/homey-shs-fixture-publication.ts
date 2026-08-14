import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rename, rm, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const digestFixtureCorpus = async (root: string): Promise<string> => {
	const hash = createHash('sha256');

	const visit = async (directory: string, relativeDirectory = ''): Promise<void> => {
		const entries = await readdir(directory, { withFileTypes: true });

		for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
			const relativePath = relativeDirectory === '' ? entry.name : `${relativeDirectory}/${entry.name}`;
			const absolutePath = resolve(directory, entry.name);

			if (entry.isDirectory()) {
				hash.update(`directory:${relativePath}\0`);
				await visit(absolutePath, relativePath);
				continue;
			}

			if (!entry.isFile()) {
				throw new Error('Homey fixture versions may only contain regular files and directories');
			}

			hash.update(`file:${relativePath}\0`);
			hash.update(await readFile(absolutePath));
		}
	};

	await visit(root);

	return hash.digest('hex');
};

export const publishHomeyFixtureCorpus = async (
	outputRoot: string,
	stagingRoot: string,
	versionName: string,
): Promise<void> => {
	const versionsRoot = resolve(outputRoot, 'versions');
	const versionRoot = resolve(versionsRoot, versionName);

	try {
		await rename(stagingRoot, versionRoot);
	} catch (error) {
		const errorCode = (error as NodeJS.ErrnoException).code;

		if (errorCode !== 'EEXIST' && errorCode !== 'ENOTEMPTY') {
			throw error;
		}

		const [stagedDigest, existingDigest] = await Promise.all([
			digestFixtureCorpus(stagingRoot),
			digestFixtureCorpus(versionRoot),
		]);

		if (stagedDigest !== existingDigest) {
			throw new Error(`Homey fixture version ${versionName} already exists with different content`, { cause: error });
		}

		await rm(stagingRoot, { recursive: true });
	}

	const pointerParent = await mkdtemp(resolve(outputRoot, '.pointer-'));
	const nextPointer = resolve(pointerParent, 'current');

	try {
		await symlink(`versions/${versionName}`, nextPointer);
		await rename(nextPointer, resolve(outputRoot, 'current'));
	} finally {
		await rm(pointerParent, { force: true, recursive: true });
	}
};
