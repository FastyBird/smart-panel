/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: `expect(Logger.prototype.warn).toHaveBeenCalledWith(...)` reads the
mocked method off the prototype directly (the established pattern for
asserting on `createExtensionLogger` output in this codebase), which ESLint
otherwise flags as an unsafe unbound reference.
*/
import { Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StorageService } from '../storage/services/storage.service';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';

import { ApiModule } from './api.module';
import { ApiStatsProvider } from './providers/api-stats.provider';
import { TrustedProxyRegistryService } from './services/trusted-proxy-registry.service';

function buildApiModule(envTrustedProxies: string): {
	apiModule: ApiModule;
	trustedProxyRegistry: TrustedProxyRegistryService;
} {
	const nestConfigService = { get: jest.fn().mockReturnValue(envTrustedProxies) } as unknown as NestConfigService;
	const trustedProxyRegistry = new TrustedProxyRegistryService();

	const apiModule = new ApiModule(
		{} as ApiStatsProvider,
		{ register: jest.fn() } as unknown as StatsRegistryService,
		{ registerSchema: jest.fn() } as unknown as StorageService,
		{ register: jest.fn() } as unknown as SwaggerModelsRegistryService,
		trustedProxyRegistry,
		nestConfigService,
	);

	return { apiModule, trustedProxyRegistry };
}

describe('ApiModule FB_TRUSTED_PROXIES parsing', () => {
	beforeEach(() => {
		// `jest.setup.ts` re-installs this spy every test but reuses the
		// same mock instance, so call history otherwise leaks across `it`
		// blocks within this file.
		(Logger.prototype.warn as jest.Mock).mockClear();
	});

	it('trusts every well-formed entry and drops a malformed one', () => {
		const { apiModule, trustedProxyRegistry } = buildApiModule('198.51.100.4, not-a-proxy, 10.0.0.0/8');
		apiModule.onModuleInit();

		expect(trustedProxyRegistry.isTrusted('198.51.100.4')).toBe(true);
		expect(trustedProxyRegistry.isTrusted('10.1.2.3')).toBe(true);
		expect(trustedProxyRegistry.isTrusted('not-a-proxy')).toBe(false);
	});

	it('logs a warning naming the rejected entry so an operator can spot a typo, hostname or bracketed IPv6', () => {
		const { apiModule, trustedProxyRegistry } = buildApiModule('proxy.example.internal, [::1]');
		apiModule.onModuleInit();

		trustedProxyRegistry.isTrusted('203.0.113.1'); // triggers the lazy addresses() read

		expect(Logger.prototype.warn).toHaveBeenCalledWith(
			expect.stringContaining('proxy.example.internal'),
			expect.objectContaining({ tag: 'api-module' }),
		);
		expect(Logger.prototype.warn).toHaveBeenCalledWith(
			expect.stringContaining('[::1]'),
			expect.objectContaining({ tag: 'api-module' }),
		);
	});

	it('logs each malformed entry once, not once per isTrusted() call', () => {
		const { apiModule, trustedProxyRegistry } = buildApiModule('not-a-proxy');
		apiModule.onModuleInit();

		trustedProxyRegistry.isTrusted('203.0.113.1');
		trustedProxyRegistry.isTrusted('203.0.113.2');
		trustedProxyRegistry.isTrusted('203.0.113.3');

		expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
	});

	it('does not warn when FB_TRUSTED_PROXIES is unset', () => {
		const { apiModule, trustedProxyRegistry } = buildApiModule('');
		apiModule.onModuleInit();

		trustedProxyRegistry.isTrusted('203.0.113.1');

		expect(Logger.prototype.warn).not.toHaveBeenCalled();
	});
});
