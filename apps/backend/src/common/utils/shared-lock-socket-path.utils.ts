import { createHash } from 'node:crypto';
import { realpath, symlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const POSIX_SHARED_LOCK_DIRECTORY = '/tmp';

interface FileSystemError extends Error {
	code?: string;
}

export const sharedLockSocketPath = async (
	namespace: string,
	database: unknown,
	ownerToken: string,
): Promise<string> => {
	const ownerHash = createHash('sha256').update(ownerToken).digest('hex').slice(0, 24);
	const socketName = `.fb-${namespace}-${ownerHash}.sock`;

	if (process.platform === 'win32') {
		return `\\\\.\\pipe\\${socketName}`;
	}
	if (typeof database !== 'string' || database === ':memory:') {
		return `${POSIX_SHARED_LOCK_DIRECTORY}/${socketName}`;
	}

	const databaseDirectory = await realpath(dirname(resolve(database)));
	const directoryHash = createHash('sha256').update(databaseDirectory).digest('hex').slice(0, 12);
	const sharedDirectoryAlias = `${POSIX_SHARED_LOCK_DIRECTORY}/.fb-lock-${directoryHash}`;

	try {
		await symlink(databaseDirectory, sharedDirectoryAlias, 'dir');
	} catch (error) {
		if ((error as FileSystemError).code !== 'EEXIST') {
			throw error;
		}
		if ((await realpath(sharedDirectoryAlias)) !== databaseDirectory) {
			throw new Error('Shared lock socket directory alias points to an unexpected location', { cause: error });
		}
	}

	// The address handed to the kernel stays short, while resolving the alias places the socket file
	// beside the SQLite database. Separate containers can create different local aliases to the same
	// mounted directory and still connect through the common token-derived socket filename.
	return `${sharedDirectoryAlias}/${socketName}`;
};
