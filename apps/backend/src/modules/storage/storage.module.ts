import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { UpdateStorageConfigDto } from './dto/update-config.dto';
import { StorageConfigModel } from './models/config.model';
import { InfluxV1PluginModule } from './plugins/influx-v1/influx-v1.module';
import { MemoryPluginModule } from './plugins/memory/memory.module';
import { StorageService } from './services/storage.service';
import { STORAGE_MODULE_NAME } from './storage.constants';
import { STORAGE_MODULE_SWAGGER_EXTRA_MODELS } from './storage.openapi';

@ApiTag({
	tagName: STORAGE_MODULE_NAME,
	displayName: 'Storage module',
	description: 'Endpoints related to time-series storage configuration.',
})
@Module({
	imports: [NestConfigModule, SwaggerModule, InfluxV1PluginModule, MemoryPluginModule],
	providers: [StorageService],
	exports: [StorageService],
})
export class StorageModule implements OnModuleInit {
	constructor(
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.modulesMapperService.registerMapping<StorageConfigModel, UpdateStorageConfigDto>({
			type: STORAGE_MODULE_NAME,
			class: StorageConfigModel,
			configDto: UpdateStorageConfigDto,
		});

		for (const model of STORAGE_MODULE_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerModuleMetadata({
			type: STORAGE_MODULE_NAME,
			name: 'Storage',
			description: 'Time-series storage with plugin architecture. Supports pluggable storage backends.',
			author: 'FastyBird',
			readme: `# Storage Module

The Storage module provides time-series data storage for the Smart Panel via a plugin architecture.

## Configuration

- **primaryStorage** — Plugin to use as primary storage
- **fallbackStorage** — Plugin to use when primary is unavailable`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
