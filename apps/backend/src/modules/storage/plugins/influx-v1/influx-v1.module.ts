import { Module, OnModuleInit, forwardRef } from '@nestjs/common';

import { ConfigService } from '../../../config/services/config.service';
import { PluginsTypeMapperService } from '../../../config/services/plugins-type-mapper.service';
import { ExtensionsService } from '../../../extensions/services/extensions.service';
import { SwaggerModelsRegistryService } from '../../../swagger/services/swagger-models-registry.service';
import { StorageService } from '../../services/storage.service';
import { StorageModule } from '../../storage.module';

import { InfluxV1ConfigModel } from './influx-v1.config.model';
import { INFLUX_V1_PLUGIN_NAME } from './influx-v1.constants';
import { INFLUX_V1_SWAGGER_EXTRA_MODELS } from './influx-v1.openapi';
import { InfluxV1Plugin } from './influx-v1.plugin';
import { UpdateInfluxV1ConfigDto } from './influx-v1.update-config.dto';

@Module({
	imports: [forwardRef(() => StorageModule)],
})
export class InfluxV1PluginModule implements OnModuleInit {
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

			return new InfluxV1Plugin({
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

	private getPluginConfig(): InfluxV1ConfigModel {
		try {
			return this.configService.getPluginConfig<InfluxV1ConfigModel>(INFLUX_V1_PLUGIN_NAME);
		} catch {
			return new InfluxV1ConfigModel();
		}
	}
}
