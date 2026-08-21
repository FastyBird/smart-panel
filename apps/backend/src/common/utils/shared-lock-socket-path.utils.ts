import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const POSIX_SHARED_LOCK_DIRECTORY = '/tmp';

export const sharedLockSocketPath = (namespace: string, database: unknown, ownerToken: string): string => {
	const databaseIdentity = typeof database === 'string' && database !== ':memory:' ? resolve(database) : ':memory:';
	const identityHash = createHash('sha256')
		.update(databaseIdentity)
		.update('\0')
		.update(ownerToken)
		.digest('hex')
		.slice(0, 48);
	const socketName = `fb-${namespace}-${identityHash}`;

	return process.platform === 'win32'
		? `\\\\.\\pipe\\${socketName}`
		: `${POSIX_SHARED_LOCK_DIRECTORY}/.${socketName}.sock`;
};
