import { Module } from '@nestjs/common';

import { ToolProviderRegistryService } from './services/tool-provider-registry.service';

@Module({
	providers: [ToolProviderRegistryService],
	exports: [ToolProviderRegistryService],
})
export class ToolsModule {}
