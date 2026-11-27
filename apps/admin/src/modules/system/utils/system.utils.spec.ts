import { describe, expect, it } from 'vitest';

import { formatSize, formatUptime, logLevelStatus, throttleProblems } from './system.utils';

describe('system utils', () => {
	it('formats the uptime as days and a clock', () => {
		expect(formatUptime(59)).toBe('00:00:59');
		expect(formatUptime(3 * 86400 + 4 * 3600 + 12 * 60 + 9)).toBe('3d 04:12:09');
		expect(formatUptime(null)).toBeNull();
		expect(formatUptime(undefined)).toBeNull();
	});

	it('formats a size in the largest fitting unit', () => {
		expect(formatSize(512)).toBe('512 B');
		expect(formatSize(1536)).toBe('1.5 KB');
		expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB');
		expect(formatSize(2 * 1024 * 1024 * 1024)).toBe('2.0 GB');
	});

	it('colours a log level by how bad it is', () => {
		expect(logLevelStatus('fatal')).toBe('critical');
		expect(logLevelStatus('error')).toBe('danger');
		expect(logLevelStatus('fail')).toBe('danger');
		expect(logLevelStatus('warn')).toBe('warn');
		expect(logLevelStatus('success')).toBe('ok');
		expect(logLevelStatus('info')).toBe('info');
		expect(logLevelStatus('debug')).toBe('info');
	});

	it('lists the throttle flags that are set', () => {
		expect(throttleProblems(null)).toEqual([]);
		expect(throttleProblems({ undervoltage: false, frequencyCapping: false, throttling: false, softTempLimit: false })).toEqual([]);
		expect(throttleProblems({ undervoltage: true, frequencyCapping: false, throttling: true, softTempLimit: false })).toEqual([
			'undervoltage',
			'throttling',
		]);
	});
});
