import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

describe('fixed privileged helper protocol', () => {
	it('rejects untrusted requests and isolates command environments', () => {
		expect(() =>
			execFileSync('python3', ['-I', join(__dirname, 'privileged', 'test_helper.py')], {
				timeout: 30_000,
				stdio: 'pipe',
			}),
		).not.toThrow();
	});
});
