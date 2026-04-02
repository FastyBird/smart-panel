import { Module, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../common/logger';
import { ConfigService } from '../../modules/config/services/config.service';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { StorageService } from '../../modules/storage/services/storage.service';
import { StorageModule } from '../../modules/storage/storage.module';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';

import { InfluxV1ConfigModel } from './influx-v1.config.model';
import { INFLUX_V1_PLUGIN_NAME } from './influx-v1.constants';
import { INFLUX_V1_SWAGGER_EXTRA_MODELS } from './influx-v1.openapi';
import { InfluxV1Storage } from './influx-v1.storage';
import { UpdateInfluxV1ConfigDto } from './influx-v1.update-config.dto';

@Module({
	imports: [StorageModule],
})
export class InfluxV1Plugin implements OnModuleInit {
	constructor(
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly configService: ConfigService,
		private readonly storageService: StorageService,
	) {}

	onModuleInit() {
		this.pluginsMapperService.registerMapping<InfluxV1ConfigModel, UpdateInfluxV1ConfigDto>({
			type: INFLUX_V1_PLUGIN_NAME,
			class: InfluxV1ConfigModel,
			configDto: UpdateInfluxV1ConfigDto,
		});

		this.storageService.registerPluginFactory(INFLUX_V1_PLUGIN_NAME, () => {
			const pluginConfig = this.getPluginConfig();

			return new InfluxV1Storage({
				host: pluginConfig.host,
				database: pluginConfig.database,
				username: pluginConfig.username,
				password: pluginConfig.password,
			});
		});

		for (const model of INFLUX_V1_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

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
	}

	private readonly logger = createExtensionLogger(INFLUX_V1_PLUGIN_NAME, 'InfluxV1Plugin');

	private getPluginConfig(): InfluxV1ConfigModel {
		try {
			return this.configService.getPluginConfig<InfluxV1ConfigModel>(INFLUX_V1_PLUGIN_NAME);
		} catch (error) {
			this.logger.warn(
				'Failed to load InfluxDB plugin configuration, using defaults',
				error instanceof Error ? error.message : String(error),
			);

			return new InfluxV1ConfigModel();
		}
	}
}
