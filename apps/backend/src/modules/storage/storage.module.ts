import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { UpdateStorageConfigDto } from './dto/update-config.dto';
import { StorageConfigModel } from './models/config.model';
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
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.modulesMapperService.registerMapping<StorageConfigModel, UpdateStorageConfigDto>({
			type: STORAGE_MODULE_NAME,
			class: StorageConfigModel,
			configDto: UpdateStorageConfigDto,
		});

		for (const model of STORAGE_MODULE_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerModuleMetadata({
			type: STORAGE_MODULE_NAME,
			name: 'Storage',
			description: 'Time-series storage with plugin architecture. Supports pluggable storage backends.',
			author: 'FastyBird',
			readme: `# Storage

> Module · by FastyBird

Provides time-series data storage for property values, device statuses and other historical metrics. Backends are pluggable — install a storage plugin and select it as the primary (and optional fallback) backend. Other modules don't talk to a database directly: they declare a schema, and the storage module routes writes / queries to the configured backend.

## What it gives you

- A uniform write API across every backend (in-memory, InfluxDB 1.x, InfluxDB 2.x, future ones); module code stays identical when you swap engines
- Automatic fallback — if the primary backend is down or unreachable, writes go to the fallback so dashboards keep filling out and nothing is lost
- A central schema registry so modules describe the *shape* of the data they need (tags, fields, retention) and the backend translates that into bucket / measurement / retention-policy on the actual store
- Optional continuous-query support so backends that can downsample do, and dashboards stay fast on long ranges

## Features

- **Pluggable backends** — any storage plugin can register; selection is at runtime via configuration so you can swap engines without changing module code
- **Primary + fallback** — every write is attempted on the primary, and routed to the fallback on failure; reads prefer the primary but fall through automatically
- **Schema registry** — modules declare the time-series schemas they need (measurement name, tags, fields, retention); applied to every registered backend at startup
- **Continuous queries** — backends that support it (InfluxDB) get automatic downsampling so 1-minute / 1-hour rollups exist without a cron
- **Connection health** — health checks per backend; the system module surfaces a warning when the primary is degraded
- **Typed query helpers** — query builders for time-bucketed values, last-known reading and aggregate counts
- **Factory-reset hook** — clears every registered backend in one go when a factory reset is performed

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`primary_storage\` | Plugin used as the primary storage backend | — |
| \`fallback_storage\` | Plugin used when the primary backend is unavailable | — |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
