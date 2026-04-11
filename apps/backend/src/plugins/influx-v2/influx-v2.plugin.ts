import { Module, OnModuleInit } from '@nestjs/common';

import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { PluginServiceManagerService } from '../../modules/extensions/services/plugin-service-manager.service';
import { StorageModule } from '../../modules/storage/storage.module';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';

import { UpdateInfluxV2ConfigDto } from './dto/update-config.dto';
import { INFLUX_V2_PLUGIN_NAME } from './influx-v2.constants';
import { INFLUX_V2_SWAGGER_EXTRA_MODELS } from './influx-v2.openapi';
import { InfluxV2ConfigModel } from './models/config.model';
import { InfluxV2ManagedService } from './services/influx-v2-managed.service';

@Module({
	imports: [StorageModule],
	providers: [InfluxV2ManagedService],
})
export class InfluxV2Plugin implements OnModuleInit {
	constructor(
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly influxV2ManagedService: InfluxV2ManagedService,
		private readonly pluginServiceManager: PluginServiceManagerService,
	) {}

	onModuleInit() {
		this.pluginsMapperService.registerMapping<InfluxV2ConfigModel, UpdateInfluxV2ConfigDto>({
			type: INFLUX_V2_PLUGIN_NAME,
			class: InfluxV2ConfigModel,
			configDto: UpdateInfluxV2ConfigDto,
		});

		for (const model of INFLUX_V2_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: INFLUX_V2_PLUGIN_NAME,
			name: 'InfluxDB v2',
			description:
				'InfluxDB 2.x time-series storage backend with Flux query language, token-based auth, and bucket management.',
			author: 'FastyBird',
			readme: `# InfluxDB v2 Plugin

Connects to an InfluxDB 2.x server and provides time-series storage using the Flux query language, buckets, organizations, and token-based authentication.

## Configuration

- **url** — InfluxDB v2 server URL (default: http://127.0.0.1:8086)
- **token** — API token for authentication
- **org** — Organization name (default: fastybird)
- **bucket** — Bucket name (default: fastybird)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register service with the centralized plugin service manager
		// The manager handles startup, shutdown, and config-based enable/disable
		this.pluginServiceManager.register(this.influxV2ManagedService);
	}
}
