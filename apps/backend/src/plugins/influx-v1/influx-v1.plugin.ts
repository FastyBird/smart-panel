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
			readme: `# InfluxDB v1

> Plugin · by FastyBird · platform: storage

Time-series storage backend that connects Smart Panel to an InfluxDB 1.x server. Persists historical property values, device statuses and energy buckets with full InfluxDB features — retention policies, continuous queries and the native HTTP query API.

## What you get

- Production-grade history: long-term retention with InfluxDB's continuous queries doing the downsampling so dashboards stay fast on year-long ranges
- A backend that scales beyond what an embedded store can handle, including multi-tenant or multi-installation scenarios
- A familiar query language for ops: data is in standard InfluxDB measurements / fields / tags, queryable with InfluxQL from any tool you already use
- Smart fallback partner — pair it with \`memory-storage\` as the fallback so a network blip never loses data

## Capabilities

- **Bulk writes** — buffered batched writes to keep load on the DB low
- **Retention policies** — automatically created from each module's schema (e.g. raw 24h, 1-minute / 14d, 1-hour / 1y)
- **Continuous queries** — automatic downsampling so dashboards have fast roll-ups
- **Time-bucketed reads** — the storage module's query helpers translate to optimal InfluxQL
- **Health checks** — surface degraded connectivity to the system module so the admin UI can warn the user

## Setup

1. Run an InfluxDB 1.x server reachable from the backend
2. Create a database (defaults to \`fastybird\`)
3. Enable this plugin and fill in the configuration
4. Pick this plugin as the primary storage backend in the storage module configuration

## Setup

1. Run an InfluxDB 1.x server reachable from the backend
2. Create a database (defaults to \`fastybird\`)
3. Enable this plugin and fill in the configuration
4. The Storage module will start writing time-series data through this plugin

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`host\` | InfluxDB server host or IP | \`127.0.0.1\` |
| \`database\` | InfluxDB database name | \`fastybird\` |
| \`username\` | Optional username for authentication | — |
| \`password\` | Optional password for authentication | — |`,
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
