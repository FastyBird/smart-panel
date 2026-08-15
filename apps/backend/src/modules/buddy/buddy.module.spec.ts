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
});
