import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { CreateDataSourceDto } from '../../modules/dashboard/dto/create-data-source.dto';
import { UpdateDataSourceDto } from '../../modules/dashboard/dto/update-data-source.dto';
import { DataSourceEntity } from '../../modules/dashboard/entities/dashboard.entity';
import { DataSourceRelationsLoaderRegistryService } from '../../modules/dashboard/services/data-source-relations-loader-registry.service';
import { DataSourcesTypeMapperService } from '../../modules/dashboard/services/data-source-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { DATA_SOURCES_DEVICE_PLUGIN_NAME, DATA_SOURCES_DEVICE_TYPE } from './data-sources-device-channel.constants';
import { DATA_SOURCES_DEVICE_CHANNEL_PLUGIN_SWAGGER_EXTRA_MODELS } from './data-sources-device-channel.openapi';
import { CreateDeviceChannelDataSourceDto } from './dto/create-data-source.dto';
import { DeviceChannelUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateDeviceChannelDataSourceDto } from './dto/update-data-source.dto';
import { DeviceChannelDataSourceEntity } from './entities/data-sources-device-channel.entity';
import { DeviceChannelConfigModel } from './models/config.model';
import { DataSourceRelationsLoaderService } from './services/data-source-relations-loader.service';
import { ChannelPropertyExistsConstraintValidator } from './validators/channel-property-exists-constraint.validator';
import { DeviceChannelExistsConstraintValidator } from './validators/device-channel-exists-constraint.validator';
import { DeviceExistsConstraintValidator } from './validators/device-exists-constraint.validator';

@Module({
	imports: [
		TypeOrmModule.forFeature([DeviceChannelDataSourceEntity]),
		DashboardModule,
		DevicesModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [
		DeviceExistsConstraintValidator,
		DeviceChannelExistsConstraintValidator,
		ChannelPropertyExistsConstraintValidator,
		DataSourceRelationsLoaderService,
	],
})
export class DataSourcesDeviceChannelPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly dataSourcesMapper: DataSourcesTypeMapperService,
		private readonly dataSourceRelationsLoaderRegistryService: DataSourceRelationsLoaderRegistryService,
		private readonly dataSourceRelationsLoaderService: DataSourceRelationsLoaderService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<DeviceChannelConfigModel, DeviceChannelUpdatePluginConfigDto>({
			type: DATA_SOURCES_DEVICE_PLUGIN_NAME,
			class: DeviceChannelConfigModel,
			configDto: DeviceChannelUpdatePluginConfigDto,
		});

		this.dataSourcesMapper.registerMapping<
			DeviceChannelDataSourceEntity,
			CreateDeviceChannelDataSourceDto,
			UpdateDeviceChannelDataSourceDto
		>({
			type: DATA_SOURCES_DEVICE_TYPE,
			class: DeviceChannelDataSourceEntity,
			createDto: CreateDeviceChannelDataSourceDto,
			updateDto: UpdateDeviceChannelDataSourceDto,
		});

		this.dataSourceRelationsLoaderRegistryService.register(this.dataSourceRelationsLoaderService);

		for (const model of DATA_SOURCES_DEVICE_CHANNEL_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: DataSourceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: DATA_SOURCES_DEVICE_TYPE,
			modelClass: DeviceChannelDataSourceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateDataSourceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DATA_SOURCES_DEVICE_TYPE,
			modelClass: CreateDeviceChannelDataSourceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateDataSourceDto,
			discriminatorProperty: 'type',
			discriminatorValue: DATA_SOURCES_DEVICE_TYPE,
			modelClass: UpdateDeviceChannelDataSourceDto,
		});

		this.extensionsService.registerPluginMetadata({
			type: DATA_SOURCES_DEVICE_PLUGIN_NAME,
			name: 'Device Channel Property Data Source',
			description: 'Data sources for connecting tiles to device channel properties',
			author: 'FastyBird',
			readme: `# Device Channel Data Source

> Plugin · by FastyBird · platform: dashboard data sources

Data source that binds a dashboard tile to a single device-channel property. Reads stream live to the tile; tiles that support writing can push values back through the property's platform handler — so the same data source powers both a sensor display and an interactive switch.

## What you get

- A no-code way to wire any dashboard tile to any device property without ever leaving the admin UI
- The same optimistic-UI guarantees the rest of the panel uses: feedback is instant, the value reconciles with the device when the backend confirms
- Strict validation: a tile that points at a missing or deleted property is refused at save time
- Type-aware rendering: the tile knows whether the underlying property is a boolean, number, string or enum and renders the right control / unit / formatter

## Features

- **Property binding** — link a tile to \`device → channel → property\` with one config object
- **Real-time updates** — values stream over WebSocket; tiles re-render only when the value changes
- **Bidirectional** — read and (optionally) write; whether writes are allowed is derived from the property's permissions, never overridden by the tile
- **Validation** — referenced device, channel and property must exist; the data source survives device renames but breaks loudly if the property is deleted

## Supported Property Types

Boolean (on / off states), numeric (temperature, humidity, …), string and enum.

Each data source picks its target \`device_id\`, \`channel_id\` and \`property_id\` when it is created — there is no global plugin configuration.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
