import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readlink, realpath, rm, symlink, unlink } from 'node:fs/promises';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { sharedLockSocketPath } from './shared-lock-socket-path.utils';

describe('sharedLockSocketPath', () => {
	let root: string;
	const aliases = new Set<string>();

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), 'shared-lock-path-'));
	});

	afterEach(async () => {
		await Promise.all(Array.from(aliases, (alias) => unlink(alias).catch(() => undefined)));
		aliases.clear();
		await rm(root, { recursive: true, force: true });
	});

	const trackAlias = (socketPath: string): string => {
		aliases.add(dirname(socketPath));

		return socketPath;
	};

	it('keeps a deep database path bounded while placing the socket on shared storage', async () => {
		const directory = join(root, ...Array.from({ length: 12 }, () => 'deep-directory'));
		await mkdir(directory, { recursive: true });
		const socketPath = trackAlias(
			await sharedLockSocketPath('property', join(directory, 'database.sqlite'), 'owner-token'),
		);

		expect(Buffer.byteLength(socketPath)).toBeLessThan(100);
		expect(socketPath).not.toContain('deep-directory');
		expect(await realpath(join(socketPath, '..'))).toBe(await realpath(directory));
	});

	it('reaches the same physical filename through differently mounted shared directories', async () => {
		const firstDirectory = join(root, 'first-mount');
		const secondDirectory = join(root, 'second-mount');
		await mkdir(firstDirectory);
		await symlink(firstDirectory, secondDirectory, 'dir');
		const first = trackAlias(
			await sharedLockSocketPath('property', join(firstDirectory, 'database.sqlite'), 'owner-one'),
		);
		const second = trackAlias(
			await sharedLockSocketPath('property', join(secondDirectory, 'database.sqlite'), 'owner-one'),
		);

		expect(first).toBe(second);
		expect(await readlink(join(first, '..'))).toBe(await realpath(firstDirectory));
	});

	it('connects to one shared socket file through independent local aliases', async () => {
		const sharedDirectory = join(root, 'shared-database-directory');
		const suffix = randomUUID().slice(0, 8);
		const firstAlias = `/tmp/.fb-test-a-${suffix}`;
		const secondAlias = `/tmp/.fb-test-b-${suffix}`;
		await mkdir(sharedDirectory);
		await symlink(sharedDirectory, firstAlias, 'dir');
		await symlink(sharedDirectory, secondAlias, 'dir');
		aliases.add(firstAlias);
		aliases.add(secondAlias);
		const socketName = '.fb-property-owner.sock';
		const server = createServer((socket) => socket.end());

		await new Promise<void>((resolveListen, reject) => {
			server.once('error', reject);
			server.listen(join(firstAlias, socketName), resolveListen);
		});
		try {
			await new Promise<void>((resolveConnect, reject) => {
				const socket = createConnection(join(secondAlias, socketName));
				socket.once('connect', () => {
					socket.destroy();
					resolveConnect();
				});
				socket.once('error', reject);
			});
		} finally {
			await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
		}
	});

	it('separates owner tokens and lock namespaces', async () => {
		const database = join(root, 'database.sqlite');
		const first = trackAlias(await sharedLockSocketPath('property', database, 'owner-one'));

		expect(trackAlias(await sharedLockSocketPath('property', database, 'owner-two'))).not.toBe(first);
		expect(trackAlias(await sharedLockSocketPath('homey', database, 'owner-one'))).not.toBe(first);
	});
});
