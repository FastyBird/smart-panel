import { Module, OnModuleInit } from '@nestjs/common';

import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { StorageService } from '../../modules/storage/services/storage.service';
import { StorageModule } from '../../modules/storage/storage.module';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';

import { MemoryConfigModel } from './memory-storage.config.model';
import { MEMORY_PLUGIN_NAME } from './memory-storage.constants';
import { MEMORY_SWAGGER_EXTRA_MODELS } from './memory-storage.openapi';
import { MemoryStorage } from './memory-storage.storage';
import { UpdateMemoryConfigDto } from './memory-storage.update-config.dto';

@Module({
	imports: [StorageModule],
})
export class MemoryStoragePlugin implements OnModuleInit {
	constructor(
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly storageService: StorageService,
	) {}

	onModuleInit() {
		this.pluginsMapperService.registerMapping<MemoryConfigModel, UpdateMemoryConfigDto>({
			type: MEMORY_PLUGIN_NAME,
			class: MemoryConfigModel,
			configDto: UpdateMemoryConfigDto,
		});

		this.storageService.registerPluginFactory(MEMORY_PLUGIN_NAME, () => {
			return new MemoryStorage();
		});

		for (const model of MEMORY_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: MEMORY_PLUGIN_NAME,
			name: 'In-Memory Storage',
			description:
				'In-memory ring-buffer storage. Data is lost on restart. Used as default fallback when no external database is available.',
			author: 'FastyBird',
			readme: `# In-Memory Storage Plugin

Stores time-series data in process memory with automatic eviction. Always available — used as the default fallback when the primary storage is unreachable.

## Limitations

- Data does NOT persist across process restarts
- Limited to 10,000 points per measurement
- Points older than 24 hours are automatically evicted
- No continuous query support`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
