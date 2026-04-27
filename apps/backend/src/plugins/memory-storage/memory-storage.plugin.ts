import { Module, OnModuleInit } from '@nestjs/common';

import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { PluginServiceManagerService } from '../../modules/extensions/services/plugin-service-manager.service';
import { StorageModule } from '../../modules/storage/storage.module';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';

import { UpdateMemoryConfigDto } from './dto/update-config.dto';
import { MEMORY_PLUGIN_NAME } from './memory-storage.constants';
import { MEMORY_SWAGGER_EXTRA_MODELS } from './memory-storage.openapi';
import { MemoryConfigModel } from './models/config.model';
import { MemoryStorageManagedService } from './services/memory-storage-managed.service';

@Module({
	imports: [StorageModule],
	providers: [MemoryStorageManagedService],
})
export class MemoryStoragePlugin implements OnModuleInit {
	constructor(
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly memoryStorageManagedService: MemoryStorageManagedService,
		private readonly pluginServiceManager: PluginServiceManagerService,
	) {}

	onModuleInit() {
		this.pluginsMapperService.registerMapping<MemoryConfigModel, UpdateMemoryConfigDto>({
			type: MEMORY_PLUGIN_NAME,
			class: MemoryConfigModel,
			configDto: UpdateMemoryConfigDto,
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
			readme: `# In-Memory Storage

> Plugin · by FastyBird · platform: storage

Process-local ring-buffer time-series storage. Always available and used as the default fallback when no external database (InfluxDB, …) is configured or reachable. The "no-config, just works" backend that keeps the panel functional out of the box.

## What you get

- Zero-setup history: the panel starts up and dashboards have data immediately, no Influx instance required
- A safety net for production setups: pair it with an external backend as the fallback so a network blip never loses recent data
- Fast: every read / write is a memory operation, there is no network in the path
- Predictable footprint — the ring buffer is hard-capped, so a misbehaving sensor can't fill the host's RAM

## Use cases

- **Out-of-the-box experience** — the panel works the moment it is installed, dashboards show real data within minutes
- **Development and tests** — no Docker container or external service needed to exercise the time-series path
- **Fallback for the primary backend** — keep the last 24 h locally so a temporary Influx outage doesn't black out the dashboards
- **Tiny installations** — homes with few devices and short histories can run entirely on this backend

## Limitations

- Data does **not** persist across process restarts
- Capped at 10 000 points per measurement
- Points older than 24 hours are evicted automatically
- No continuous-query support — downsampling is provided in a best-effort, on-the-fly manner`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register service with the centralized plugin service manager
		// The manager handles startup, shutdown, and config-based enable/disable
		this.pluginServiceManager.register(this.memoryStorageManagedService);
	}
}
