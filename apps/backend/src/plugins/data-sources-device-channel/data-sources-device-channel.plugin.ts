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
			name: 'Device Channel Data Sources',
			description: 'Data sources for connecting tiles to device channel properties',
			author: 'FastyBird',
			readme: `# Device Channel Data Sources Plugin

Data source type for connecting dashboard tiles to device properties.

## Features

- **Property Binding** - Link tiles to specific device properties
- **Real-time Updates** - Receive live property value changes
- **Bidirectional** - Support for both reading and writing values
- **Validation** - Ensures referenced device/channel/property exists

## How It Works

Data sources act as a bridge between:
- **Tiles** - Visual elements on dashboard pages
- **Device Properties** - Values from connected devices

When a property value changes, connected tiles update automatically.

## Configuration

Each data source specifies:
- Target device ID
- Channel ID within the device
- Property ID to bind to

## Usage

1. Add a tile that supports data sources
2. Create a device channel data source
3. Select device → channel → property
4. The tile will display the property value

## Supported Property Types

- Boolean (on/off states)
- Numeric (temperature, humidity, etc.)
- String (text values)
- Enum (predefined value lists)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
