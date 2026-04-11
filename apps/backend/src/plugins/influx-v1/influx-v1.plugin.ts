import { Module, OnModuleInit } from '@nestjs/common';

import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { PluginServiceManagerService } from '../../modules/extensions/services/plugin-service-manager.service';
import { StorageModule } from '../../modules/storage/storage.module';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';

import { UpdateInfluxV1ConfigDto } from './dto/update-config.dto';
import { INFLUX_V1_PLUGIN_NAME } from './influx-v1.constants';
import { INFLUX_V1_SWAGGER_EXTRA_MODELS } from './influx-v1.openapi';
import { InfluxV1ConfigModel } from './models/config.model';
import { InfluxV1ManagedService } from './services/influx-v1-managed.service';

@Module({
	imports: [StorageModule],
	providers: [InfluxV1ManagedService],
})
export class InfluxV1Plugin implements OnModuleInit {
	constructor(
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly influxV1ManagedService: InfluxV1ManagedService,
		private readonly pluginServiceManager: PluginServiceManagerService,
	) {}

	onModuleInit() {
		this.pluginsMapperService.registerMapping<InfluxV1ConfigModel, UpdateInfluxV1ConfigDto>({
			type: INFLUX_V1_PLUGIN_NAME,
			class: InfluxV1ConfigModel,
			configDto: UpdateInfluxV1ConfigDto,
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

		// Register service with the centralized plugin service manager
		// The manager handles startup, shutdown, and config-based enable/disable
		this.pluginServiceManager.register(this.influxV1ManagedService);
	}
}
