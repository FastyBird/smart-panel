import { Module, OnModuleInit } from '@nestjs/common';

import { PluginsTypeMapperService } from '../../../config/services/plugins-type-mapper.service';
import { ExtensionsService } from '../../../extensions/services/extensions.service';
import { SwaggerModelsRegistryService } from '../../../swagger/services/swagger-models-registry.service';
import { StorageService } from '../../services/storage.service';

import { MemoryConfigModel } from './memory.config.model';
import { MEMORY_PLUGIN_NAME } from './memory.constants';
import { MEMORY_SWAGGER_EXTRA_MODELS } from './memory.openapi';
import { MemoryStoragePlugin } from './memory.plugin';
import { UpdateMemoryConfigDto } from './memory.update-config.dto';

@Module({})
export class MemoryPluginModule implements OnModuleInit {
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
			return new MemoryStoragePlugin();
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
