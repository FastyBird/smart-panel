import { describe, expect, it } from 'vitest';

import {
	buildDefaultHomeyCloudRedirectUrl,
	createCandidateHomeyConnectionTestRequest,
	createSavedHomeyConnectionTestRequest,
	formatHomeyTimestamp,
	normalizeHomeyUrlInput,
} from './homey-config-form.utils';

describe('normalizeHomeyUrlInput', () => {
	it('normalizes an empty input to the backend clear sentinel', () => {
		expect(normalizeHomeyUrlInput('')).toBeNull();
		expect(normalizeHomeyUrlInput('   ')).toBeNull();
	});

	it('preserves a configured local URL', () => {
		expect(normalizeHomeyUrlInput('http://homey.local:4859')).toBe('http://homey.local:4859');
	});

	it('builds the Homey Cloud callback from the Admin origin', () => {
		expect(buildDefaultHomeyCloudRedirectUrl('http://localhost:3003')).toBe('http://localhost:3003/api/v1/plugins/devices-homey/oauth/callback');
		expect(buildDefaultHomeyCloudRedirectUrl('https://panel.example.com:8443')).toBe(
			'https://panel.example.com:8443/api/v1/plugins/devices-homey/oauth/callback'
		);
	});

	it('does not build an invalid or insecure callback', () => {
		expect(buildDefaultHomeyCloudRedirectUrl('not a URL')).toBeNull();
		expect(buildDefaultHomeyCloudRedirectUrl('http://panel.local')).toBeNull();
	});

	it('builds a saved test without connector overrides', () => {
		expect(createSavedHomeyConnectionTestRequest()).toEqual({ data: { mode: 'saved' } });
	});

	it('builds a complete candidate test with the same trimmed key that saving persists', () => {
		expect(createCandidateHomeyConnectionTestRequest('http://homey.local:4859', ' candidate-key ')).toEqual({
			data: {
				mode: 'candidate',
				url: 'http://homey.local:4859',
				api_key: 'candidate-key',
			},
		});
	});

	it.each([
		['a missing URL', null, 'candidate-key'],
		['an unsafe URL', 'http://operator:secret@homey.local:4859', 'candidate-key'],
		['a missing key', 'http://homey.local:4859', undefined],
		['a blank key', 'http://homey.local:4859', '   '],
	])('does not build a candidate test for %s', (_label, url, apiKey) => {
		expect(createCandidateHomeyConnectionTestRequest(url, apiKey)).toBeNull();
	});

	it('formats valid timestamps and rejects invalid values', () => {
		expect(formatHomeyTimestamp('2026-08-24T12:00:00.000Z')).not.toBeNull();
		expect(formatHomeyTimestamp('not-a-date')).toBeNull();
		expect(formatHomeyTimestamp(null)).toBeNull();
	});
});
