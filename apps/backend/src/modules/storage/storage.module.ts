import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { PluginsTypeMapperService } from '../config/services/plugins-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { UpdateStorageConfigDto } from './dto/update-config.dto';
import { StorageConfigModel } from './models/config.model';
import { InfluxV1ConfigModel } from './plugins/influx-v1/influx-v1.config.model';
import { INFLUX_V1_PLUGIN_NAME } from './plugins/influx-v1/influx-v1.constants';
import { UpdateInfluxV1ConfigDto } from './plugins/influx-v1/influx-v1.update-config.dto';
import { StorageService } from './services/storage.service';
import { STORAGE_MODULE_NAME } from './storage.constants';
import { STORAGE_MODULE_SWAGGER_EXTRA_MODELS } from './storage.openapi';

@ApiTag({
	tagName: STORAGE_MODULE_NAME,
	displayName: 'Storage module',
	description: 'Endpoints related to time-series storage configuration.',
})
@Module({
	imports: [NestConfigModule, SwaggerModule],
	providers: [StorageService],
	exports: [StorageService],
})
export class StorageModule implements OnModuleInit {
	constructor(
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.modulesMapperService.registerMapping<StorageConfigModel, UpdateStorageConfigDto>({
			type: STORAGE_MODULE_NAME,
			class: StorageConfigModel,
			configDto: UpdateStorageConfigDto,
		});

		this.pluginsMapperService.registerMapping<InfluxV1ConfigModel, UpdateInfluxV1ConfigDto>({
			type: INFLUX_V1_PLUGIN_NAME,
			class: InfluxV1ConfigModel,
			configDto: UpdateInfluxV1ConfigDto,
		});

		for (const model of STORAGE_MODULE_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerModuleMetadata({
			type: STORAGE_MODULE_NAME,
			name: 'Storage',
			description: 'Time-series storage with plugin architecture. Supports InfluxDB v1 and in-memory fallback.',
			author: 'FastyBird',
			readme: `# Storage Module

The Storage module provides time-series data storage for the Smart Panel via a plugin architecture.

## Plugins

- **influx-v1-plugin** — InfluxDB 1.x backend with retention policies and continuous queries
- **memory-storage-plugin** — In-memory ring-buffer store (default fallback, data lost on restart)

## Configuration

### Storage module (storage-module)
- **primaryStorage** — Plugin to use as primary storage (default: influx-v1-plugin)
- **fallbackStorage** — Plugin to use when primary is unavailable (default: memory-storage-plugin)

### InfluxDB plugin (influx-v1-plugin)
- **host** — InfluxDB server address (default: 127.0.0.1)
- **database** — InfluxDB database name (default: fastybird)
- **username/password** — Optional InfluxDB authentication`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
