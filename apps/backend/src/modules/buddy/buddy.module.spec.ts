import { MODULE_METADATA } from '@nestjs/common/constants';

import { HomeContextModule } from '../home-context/home-context.module';

import { BuddyModule } from './buddy.module';
import { HomeContextToolProviderService } from './services/home-context-tool-provider.service';

describe('BuddyModule home read tools', () => {
	it('imports the provider-neutral HomeContext module without an MCP module dependency', () => {
		const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, BuddyModule) as Array<{ name?: string }>;
		const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, BuddyModule) as unknown[];

		expect(imports).toContain(HomeContextModule);
		expect(imports.map((moduleType) => moduleType.name)).not.toContain('McpModule');
		expect(providers).toContain(HomeContextToolProviderService);
	});

	it('registers the Buddy home read provider during module initialization', () => {
		const registerToolProvider = jest.fn();
		const registerManagedService = jest.fn();
		const homeContextTools = {} as HomeContextToolProviderService;
		const heartbeatService = { registerEvaluator: jest.fn() };
		const module = new BuddyModule(
			{ register: jest.fn() } as never,
			{ registerMapping: jest.fn() } as never,
			{ registerModuleMetadata: jest.fn() } as never,
			{ register: registerManagedService } as never,
			{ reset: jest.fn() } as never,
			{ resolvePersonalityPath: jest.fn() } as never,
			{ register: jest.fn() } as never,
			{ register: jest.fn() } as never,
			heartbeatService as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{ register: registerToolProvider } as never,
			homeContextTools,
		);

		module.onModuleInit();

		expect(registerToolProvider).toHaveBeenCalledWith(homeContextTools);
		expect(registerManagedService).toHaveBeenCalledWith(heartbeatService);
	});
});
