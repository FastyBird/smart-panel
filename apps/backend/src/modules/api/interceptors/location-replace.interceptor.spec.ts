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
});
