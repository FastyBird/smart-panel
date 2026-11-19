import { describe, expect, it } from 'vitest';

import { buildApiBase, resolveIngressBase } from './ingress.utils';

describe('ingress.utils', (): void => {
	describe('resolveIngressBase', (): void => {
		it('returns the Home Assistant ingress prefix', (): void => {
			expect(resolveIngressBase('/api/hassio_ingress/abc123/devices')).toBe('/api/hassio_ingress/abc123');
		});

		it('returns an empty string outside ingress', (): void => {
			expect(resolveIngressBase('/devices')).toBe('');
		});
	});

	describe('buildApiBase', (): void => {
		it('joins origin, ingress prefix and the api path', (): void => {
			expect(buildApiBase({ origin: 'https://ha.local', pathname: '/api/hassio_ingress/abc/' })).toBe(
				'https://ha.local/api/hassio_ingress/abc/api/v1'
			);
		});

		it('omits the prefix outside ingress', (): void => {
			expect(buildApiBase({ origin: 'https://x.ts.net', pathname: '/cameras' })).toBe('https://x.ts.net/api/v1');
		});
	});
});
