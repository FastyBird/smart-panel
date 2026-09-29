import { exec } from 'child_process';
import fs from 'fs/promises';
import si, { Systeminformation } from 'systeminformation';

import { RaspberryPlatform } from './raspberry.platform';

jest.mock('child_process', () => ({
	...jest.requireActual<typeof import('child_process')>('child_process'),
	exec: jest.fn(),
}));

describe('RaspberryPlatform resolution fallback', () => {
	const graphics = {
		controllers: [],
		displays: [{ currentResX: 1920, currentResY: 1080 }],
	} as Systeminformation.GraphicsData;
	let platform: RaspberryPlatform;

	beforeEach(() => {
		platform = new RaspberryPlatform();
		jest.spyOn(si, 'graphics').mockResolvedValue({ controllers: [], displays: [] });
		jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('No framebuffer'));
		jest.mocked(exec).mockImplementation(((
			_command: string,
			callback: (error: Error | null, stdout: string) => void,
		) => {
			callback(new Error('fbset unavailable'), '');
		}) as typeof exec);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	it('prefers the current framebuffer resolution over cached graphics', async () => {
		jest.mocked(fs.readFile).mockResolvedValue('800,480\n');

		await expect(platform['getCurrentResolution'](graphics)).resolves.toEqual({ width: 800, height: 480 });
		expect(exec).not.toHaveBeenCalled();
		expect(si.graphics).not.toHaveBeenCalled();
	});

	it('uses fbset when the framebuffer file is unavailable', async () => {
		jest.mocked(exec).mockImplementation(((
			_command: string,
			callback: (error: Error | null, stdout: string) => void,
		) => {
			callback(null, 'geometry 1024 600 1024 600 32');
		}) as typeof exec);

		await expect(platform['getCurrentResolution'](graphics)).resolves.toEqual({ width: 1024, height: 600 });
		expect(si.graphics).not.toHaveBeenCalled();
	});

	it('reuses cached graphics when neither framebuffer probe is available', async () => {
		await expect(platform['getCurrentResolution'](graphics)).resolves.toEqual({ width: 1920, height: 1080 });
		expect(si.graphics).not.toHaveBeenCalled();
	});

	it('does not repeat graphics detection for a headless system', async () => {
		await expect(platform['getCurrentResolution']({ controllers: [], displays: [] })).resolves.toBeNull();
		expect(si.graphics).not.toHaveBeenCalled();
	});
});
