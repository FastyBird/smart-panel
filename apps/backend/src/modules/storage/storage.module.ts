import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { createExtensionLogger } from '../../common/logger';
import { ConfigService } from '../config/services/config.service';
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
import { InfluxV1Plugin } from './plugins/influx-v1/influx-v1.plugin';
import { UpdateInfluxV1ConfigDto } from './plugins/influx-v1/influx-v1.update-config.dto';
import { MemoryConfigModel } from './plugins/memory/memory.config.model';
import { MEMORY_PLUGIN_NAME } from './plugins/memory/memory.constants';
import { MemoryStoragePlugin } from './plugins/memory/memory.plugin';
import { UpdateMemoryConfigDto } from './plugins/memory/memory.update-config.dto';
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
		private readonly configService: ConfigService,
		private readonly storageService: StorageService,
	) {}

	onModuleInit() {
		// ─── Config mappings ─────────────────────────────────────────

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

		this.pluginsMapperService.registerMapping<MemoryConfigModel, UpdateMemoryConfigDto>({
			type: MEMORY_PLUGIN_NAME,
			class: MemoryConfigModel,
			configDto: UpdateMemoryConfigDto,
		});

		// ─── Plugin factories ────────────────────────────────────────

		this.storageService.registerPluginFactory(INFLUX_V1_PLUGIN_NAME, () => {
			const pluginConfig = this.getInfluxConfig();

			return new InfluxV1Plugin({
				host: pluginConfig.host,
				database: pluginConfig.database,
				username: pluginConfig.username,
				password: pluginConfig.password,
			});
		});

		this.storageService.registerPluginFactory(MEMORY_PLUGIN_NAME, () => {
			return new MemoryStoragePlugin();
		});

		// ─── Swagger ─────────────────────────────────────────────────

		for (const model of STORAGE_MODULE_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// ─── Extension metadata ──────────────────────────────────────

		this.extensionsService.registerPluginMetadata({
			type: INFLUX_V1_PLUGIN_NAME,
			name: 'InfluxDB v1',
			description: 'InfluxDB 1.x time-series storage backend with retention policies and continuous queries.',
			author: 'FastyBird',
			readme: `# InfluxDB v1 Plugin

Connects to an InfluxDB 1.x server and provides full time-series storage with retention policies, continuous queries, and all native InfluxDB features.

## Configuration

- **host** — InfluxDB server address (default: 127.0.0.1)
- **database** — InfluxDB database name (default: fastybird)
- **username/password** — Optional authentication credentials`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

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

- **primaryStorage** — Plugin to use as primary storage (default: influx-v1-plugin)
- **fallbackStorage** — Plugin to use when primary is unavailable (default: memory-storage-plugin)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}

	private getInfluxConfig(): InfluxV1ConfigModel {
		try {
			return this.configService.getPluginConfig<InfluxV1ConfigModel>(INFLUX_V1_PLUGIN_NAME);
		} catch (error) {
			const err = error instanceof Error ? error : String(error);

			this.logger.warn('Failed to load InfluxDB plugin configuration, using defaults', err);

			return new InfluxV1ConfigModel();
		}
	}

	private readonly logger = createExtensionLogger(STORAGE_MODULE_NAME, 'StorageModule');
}
