import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { GO2RTC_INSTALLATION_ID_FILENAME } from '../cameras.constants';

import { generateInstallationId, loadOrCreateInstallationId } from './go2rtc-installation-id';

describe('installation id', () => {
	let workDir: string;
	let dir: string;

	beforeEach(() => {
		workDir = mkdtempSync(join(tmpdir(), 'go2rtc-installation-id-'));
		dir = join(workDir, 'go2rtc');
	});

	afterEach(() => {
		rmSync(workDir, { recursive: true, force: true });
	});

	it('generates 8 characters from [a-z0-9]', () => {
		for (let i = 0; i < 50; i++) {
			expect(generateInstallationId()).toMatch(/^[a-z0-9]{8}$/);
		}
	});

	it('creates the id on first use in a 0700 directory with a 0600 file', () => {
		const id = loadOrCreateInstallationId(dir);

		expect(id).toMatch(/^[a-z0-9]{8}$/);
		expect(readFileSync(join(dir, GO2RTC_INSTALLATION_ID_FILENAME), 'utf8').trim()).toBe(id);
		expect(statSync(dir).mode & 0o777).toBe(0o700);
		expect(statSync(join(dir, GO2RTC_INSTALLATION_ID_FILENAME)).mode & 0o777).toBe(0o600);
	});

	it('reuses the stored id', () => {
		const first = loadOrCreateInstallationId(dir);

		expect(loadOrCreateInstallationId(dir)).toBe(first);
	});

	it.each(['', 'short', 'UPPERCASE', 'abcd1234extra', 'ab cd123', '../../x1'])(
		'regenerates for the invalid content %j',
		(content) => {
			loadOrCreateInstallationId(dir);
			writeFileSync(join(dir, GO2RTC_INSTALLATION_ID_FILENAME), content);

			const id = loadOrCreateInstallationId(dir);

			expect(id).toMatch(/^[a-z0-9]{8}$/);
			expect(readFileSync(join(dir, GO2RTC_INSTALLATION_ID_FILENAME), 'utf8').trim()).toBe(id);
			expect(existsSync(join(dir, GO2RTC_INSTALLATION_ID_FILENAME))).toBe(true);
		},
	);
});
