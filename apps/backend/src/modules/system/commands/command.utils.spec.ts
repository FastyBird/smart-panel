/*
Reason: asserting on jest mocks requires dynamic access that these rules flag unnecessarily.
*/
import { execFileSync } from 'child_process';

import { runPrivileged } from './command.utils';

jest.mock('child_process', () => ({
	...jest.requireActual<typeof import('child_process')>('child_process'),
	execFileSync: jest.fn(),
}));

describe('runPrivileged', () => {
	const OPTIONS = { stdio: 'pipe' } as const;

	let getuid: jest.SpyInstance | undefined;

	const asUser = (uid: number): void => {
		getuid = jest.spyOn(process, 'getuid').mockReturnValue(uid);
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		getuid?.mockRestore();
		getuid = undefined;
	});

	it('should run the command directly when that already works', () => {
		asUser(1000);
		(execFileSync as jest.Mock).mockReturnValue(Buffer.from(''));

		runPrivileged('systemctl', ['stop', 'smart-panel'], OPTIONS);

		// A host where the bare call succeeds - an npm install running as root, or a container
		// with no sudo at all - has to keep behaving exactly as it did before.
		expect(execFileSync).toHaveBeenCalledTimes(1);
		expect(execFileSync).toHaveBeenCalledWith('systemctl', ['stop', 'smart-panel'], OPTIONS);
	});

	it('should retry through sudo when the direct call is refused', () => {
		asUser(1000);
		(execFileSync as jest.Mock)
			.mockImplementationOnce(() => {
				throw new Error('Interactive authentication required');
			})
			.mockReturnValue(Buffer.from(''));

		runPrivileged('systemctl', ['start', 'smart-panel'], OPTIONS);

		expect(execFileSync).toHaveBeenCalledTimes(2);
		// -n so a host missing the sudoers entry fails now instead of blocking on a password
		// prompt that no terminal is attached to answer.
		expect(execFileSync).toHaveBeenLastCalledWith('sudo', ['-n', 'systemctl', 'start', 'smart-panel'], OPTIONS);
	});

	it('should surface the original failure instead of retrying when already root', () => {
		asUser(0);
		(execFileSync as jest.Mock).mockImplementation(() => {
			throw new Error('Unit smart-panel.service not found');
		});

		expect(() => runPrivileged('systemctl', ['start', 'smart-panel'], OPTIONS)).toThrow(
			'Unit smart-panel.service not found',
		);

		// sudo cannot turn a genuine failure into a success for root, and retrying would bury the
		// real error behind a more confusing one.
		expect(execFileSync).toHaveBeenCalledTimes(1);
	});

	it('should propagate a sudo failure to the caller', () => {
		asUser(1000);
		(execFileSync as jest.Mock)
			.mockImplementationOnce(() => {
				throw new Error('permission denied');
			})
			.mockImplementationOnce(() => {
				throw new Error('sudo: a password is required');
			});

		expect(() => runPrivileged('chown', ['-R', 'smart-panel:smart-panel', '/opt/smart-panel/v1'], OPTIONS)).toThrow(
			'sudo: a password is required',
		);
	});
});
