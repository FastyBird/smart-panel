import { PROTECT_ENDPOINTS, ProtectEndpoint } from '../devices-unifi-protect.constants';
import { ProtectApiError } from '../errors/protect-api.error';

import { PROTECT_ID_PATTERN, buildProtectPath } from './protect-endpoints';

describe('buildProtectPath', () => {
	it.each([
		['meta/info', {}, '/proxy/protect/integration/v1/meta/info'],
		['nvrs', undefined, '/proxy/protect/integration/v1/nvrs'],
		['cameras/{id}', { id: '6541' }, '/proxy/protect/integration/v1/cameras/6541'],
		[
			'cameras/{id}/snapshot',
			{ id: '6541', query: { highQuality: 'false', channel: 'main' } },
			'/proxy/protect/integration/v1/cameras/6541/snapshot?highQuality=false&channel=main',
		],
		['cameras/{id}/rtsps-stream', { id: 'a_B-9' }, '/proxy/protect/integration/v1/cameras/a_B-9/rtsps-stream'],
		['subscribe/devices', undefined, '/proxy/protect/integration/v1/subscribe/devices'],
		['subscribe/events', undefined, '/proxy/protect/integration/v1/subscribe/events'],
	])('builds %s', (endpoint, params, path) => {
		expect(buildProtectPath(endpoint as ProtectEndpoint, params)).toBe(path);
	});

	it.each(['', 'a/b', '../disable-mic-permanently', 'x'.repeat(65), 'a b', 'a?b=1', 'a%2Fb', 'a#b'])(
		'refuses the id %p',
		(id) => {
			expect(() => buildProtectPath('cameras/{id}', { id })).toThrow(ProtectApiError);
			expect(() => buildProtectPath('cameras/{id}', { id })).toThrow(/validation/);
		},
	);

	it('requires an id for templated endpoints', () => {
		expect(() => buildProtectPath('cameras/{id}')).toThrow(ProtectApiError);
	});

	it('accepts the longest valid id', () => {
		expect(PROTECT_ID_PATTERN.test('x'.repeat(64))).toBe(true);
		expect(buildProtectPath('cameras/{id}', { id: 'x'.repeat(64) })).toContain(`/cameras/${'x'.repeat(64)}`);
	});

	it('url-encodes query values', () => {
		expect(buildProtectPath('cameras/{id}/snapshot', { id: '1', query: { channel: 'a&b=c' } })).toBe(
			'/proxy/protect/integration/v1/cameras/1/snapshot?channel=a%26b%3Dc',
		);
	});

	it('refuses endpoints outside the known list, including disable-mic-permanently', () => {
		expect(() => buildProtectPath('cameras/{id}/disable-mic-permanently' as ProtectEndpoint, { id: '1' })).toThrow(
			ProtectApiError,
		);
		expect(() => buildProtectPath('liveviews' as ProtectEndpoint)).toThrow(ProtectApiError);
	});

	it('refuses the forbidden segment smuggled through a query value', () => {
		expect(() =>
			buildProtectPath('cameras/{id}/snapshot', { id: '1', query: { x: 'disable-mic-permanently' } }),
		).toThrow(ProtectApiError);
	});

	it('never builds the forbidden endpoint from any known endpoint', () => {
		for (const endpoint of PROTECT_ENDPOINTS) {
			expect(buildProtectPath(endpoint, { id: 'abc' }).toLowerCase()).not.toContain('disable-mic-permanently');
		}
	});
});
