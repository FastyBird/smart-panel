import { firstValueFrom, of } from 'rxjs';

import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { LocationReplaceInterceptor } from './location-replace.interceptor';

describe('LocationReplaceInterceptor', () => {
	it.each([undefined, null])(
		'preserves an absolute redirect with a port when the response body is %s',
		async (body) => {
			const location = 'http://panel.local:3000/config/plugins/devices-homey-plugin';
			const response = {
				getHeader: jest.fn().mockReturnValue(location),
				header: jest.fn(),
			};
			const context = {
				switchToHttp: () => ({
					getRequest: () => ({ url: '/api/v1/plugins/devices-homey/oauth/callback' }),
					getResponse: () => response,
				}),
			} as unknown as ExecutionContext;
			const next = { handle: () => of(body) } as CallHandler;
			const environment = {
				get: jest.fn((key: string) => ({ FB_APP_HOST: 'http://panel.local', FB_BACKEND_PORT: 3000 })[key]),
			};
			const interceptor = new LocationReplaceInterceptor(environment as unknown as NestConfigService);

			await expect(firstValueFrom(interceptor.intercept(context, next))).resolves.toBe(body);
			expect(response.header).toHaveBeenCalledWith('Location', location);
		},
	);

	const run = (body: unknown): Promise<unknown> => {
		const response = { getHeader: jest.fn().mockReturnValue(undefined), header: jest.fn() };
		const context = {
			switchToHttp: () => ({ getRequest: () => ({ url: '/api/v1/x' }), getResponse: () => response }),
		} as unknown as ExecutionContext;
		const environment = {
			get: jest.fn((key: string) => ({ FB_APP_HOST: 'http://panel.local', FB_BACKEND_PORT: 3000 })[key]),
		};
		const interceptor = new LocationReplaceInterceptor(environment as unknown as NestConfigService);

		return firstValueFrom(interceptor.intercept(context, { handle: () => of(body) } as CallHandler));
	};

	it('passes a deeply frozen response through untouched instead of throwing', async () => {
		const body = Object.freeze({
			data: Object.freeze({ range: Object.freeze({ minimum: -40, maximum: 80 }), reasons: Object.freeze(['fresh']) }),
		});

		await expect(run(body)).resolves.toBe(body);
	});

	it('replaces the base URL in a frozen response on a copy', async () => {
		const body = Object.freeze({ data: Object.freeze({ url: ':baseUrl/devices', count: 1 }) });

		await expect(run(body)).resolves.toEqual({ data: { url: 'http://panel.local:3000/api/v1/devices', count: 1 } });
		expect(body.data.url).toBe(':baseUrl/devices');
	});

	it('still replaces the base URL in place on a mutable response', async () => {
		const body = { data: { url: ':baseUrl/devices' } };

		await expect(run(body)).resolves.toBe(body);
		expect(body.data.url).toMatch(/\/devices$/);
		expect(body.data.url).not.toContain(':baseUrl');
	});

	it('writes every replacement to the copy when only one property is read-only', async () => {
		const body: Record<string, unknown> = {};
		Object.defineProperty(body, 'self', { value: ':baseUrl/a', enumerable: true, writable: false });
		body.next = ':baseUrl/b';

		const result = (await run({ data: body })) as { data: Record<string, string> };

		expect(result.data.self).toMatch(/\/a$/);
		expect(result.data.next).toMatch(/\/b$/);
		expect(result.data.self).not.toContain(':baseUrl');
		expect(result.data.next).not.toContain(':baseUrl');
		// The original is left untouched once a copy is needed.
		expect(body.next).toBe(':baseUrl/b');
	});
});
