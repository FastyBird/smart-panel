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
			readme: `# InfluxDB v2

> Plugin · by FastyBird · platform: storage

Time-series storage backend that writes property history, device statuses and energy buckets to an InfluxDB 2.x server. Uses the Flux query language with token-based authentication and bucket / organisation scoping — the modern InfluxDB option for new installs.

## What you get

- The current generation of InfluxDB: token authentication, organisations, buckets and the Flux query language out of the box
- Production-grade scaling for installations that retain a lot of history or run many devices
- Clean operational separation: a dedicated bucket / org so Smart Panel data doesn't mix with anything else you store in Influx
- Familiar tooling for ops: query the same data with the InfluxDB UI, Grafana or your own scripts

## Capabilities

- **Token authentication** — fine-grained access control via Influx tokens; no plaintext password
- **Bucket / organisation scoping** — tidy multi-tenant deployments
- **Flux queries** — modern query language with grouping, joining and pivoting baked in
- **Buffered writes** — batched writes minimise HTTP overhead and keep the DB happy under sustained load
- **Health checks** — surface degraded connectivity to the system module so the admin UI can warn the user

## Setup

1. Run an InfluxDB 2.x server reachable from the backend
2. Create an organisation, bucket and an API token with write access to the bucket
3. Enable this plugin and fill in the configuration
4. Pick this plugin as the primary storage backend in the storage module configuration

## Setup

1. Run an InfluxDB 2.x server reachable from the backend
2. Create an organization, bucket and an API token with write access to the bucket
3. Enable this plugin and fill in the configuration
4. The Storage module will start writing time-series data through this plugin

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`url\` | InfluxDB v2 server URL | \`http://127.0.0.1:8086\` |
| \`token\` | API token with read/write access | — |
| \`org\` | Organization name | \`fastybird\` |
| \`bucket\` | Bucket name | \`fastybird\` |`,
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
