import { sharedLockSocketPath } from './shared-lock-socket-path.utils';

describe('sharedLockSocketPath', () => {
	it('keeps a deeply nested database path out of the bounded IPC address', () => {
		const database = `/${'deep-directory/'.repeat(30)}database.sqlite`;
		const socketPath = sharedLockSocketPath('property', database, 'owner-token');

		expect(Buffer.byteLength(socketPath)).toBeLessThan(100);
		expect(socketPath).not.toContain('deep-directory');
	});

	it('separates database, owner, and lock namespaces', () => {
		const first = sharedLockSocketPath('property', '/data/first.sqlite', 'owner-one');

		expect(sharedLockSocketPath('property', '/data/second.sqlite', 'owner-one')).not.toBe(first);
		expect(sharedLockSocketPath('property', '/data/first.sqlite', 'owner-two')).not.toBe(first);
		expect(sharedLockSocketPath('homey', '/data/first.sqlite', 'owner-one')).not.toBe(first);
	});
});
