import { Global, Module } from '@nestjs/common';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { PluginsTypeMapperService } from '../config/services/plugins-type-mapper.service';

@Global()
@Module({
	providers: [ModulesTypeMapperService, PluginsTypeMapperService],
	exports: [ModulesTypeMapperService, PluginsTypeMapperService],
})
export class ModuleRegistryModule {}
