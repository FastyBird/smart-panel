import { Module } from '@nestjs/common';

import { ShortIdMappingService } from './services/short-id-mapping.service';
import { ToolProviderRegistryService } from './services/tool-provider-registry.service';

@Module({
	providers: [ToolProviderRegistryService, ShortIdMappingService],
	exports: [ToolProviderRegistryService, ShortIdMappingService],
})
export class ToolsModule {}
