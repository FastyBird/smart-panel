import { Module, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../common/logger';
import { ConfigService } from '../../modules/config/services/config.service';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { StorageService } from '../../modules/storage/services/storage.service';
import { StorageModule } from '../../modules/storage/storage.module';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';

import { UpdateInfluxV2ConfigDto } from './dto/update-config.dto';
import { INFLUX_V2_PLUGIN_NAME } from './influx-v2.constants';
import { INFLUX_V2_SWAGGER_EXTRA_MODELS } from './influx-v2.openapi';
import { InfluxV2ConfigModel } from './models/config.model';
import { InfluxV2Storage } from './services/influx-v2.storage';

@Module({
	imports: [StorageModule],
})
export class InfluxV2Plugin implements OnModuleInit {
	constructor(
		private readonly pluginsMapperService: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly configService: ConfigService,
		private readonly storageService: StorageService,
	) {}

	onModuleInit() {
		this.pluginsMapperService.registerMapping<InfluxV2ConfigModel, UpdateInfluxV2ConfigDto>({
			type: INFLUX_V2_PLUGIN_NAME,
			class: InfluxV2ConfigModel,
			configDto: UpdateInfluxV2ConfigDto,
		});

		this.storageService.registerPluginFactory(INFLUX_V2_PLUGIN_NAME, () => {
			const pluginConfig = this.getPluginConfig();

			return new InfluxV2Storage({
				url: pluginConfig.url,
				token: pluginConfig.token,
				org: pluginConfig.org,
				bucket: pluginConfig.bucket,
			});
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
	}

	private readonly logger = createExtensionLogger(INFLUX_V2_PLUGIN_NAME, 'InfluxV2Plugin');

	private getPluginConfig(): InfluxV2ConfigModel {
		try {
			return this.configService.getPluginConfig<InfluxV2ConfigModel>(INFLUX_V2_PLUGIN_NAME);
		} catch (error) {
			this.logger.warn(
				'Failed to load InfluxDB v2 plugin configuration, using defaults',
				error instanceof Error ? error.message : String(error),
			);

			return new InfluxV2ConfigModel();
		}
	}
}
