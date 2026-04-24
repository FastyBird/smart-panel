import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { CreatePageDto } from '../../modules/dashboard/dto/create-page.dto';
import { UpdatePageDto } from '../../modules/dashboard/dto/update-page.dto';
import { PageEntity } from '../../modules/dashboard/entities/dashboard.entity';
import { PageRelationsLoaderRegistryService } from '../../modules/dashboard/services/page-relations-loader-registry.service';
import { PagesTypeMapperService } from '../../modules/dashboard/services/pages-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { CreateDeviceDetailPageDto } from './dto/create-page.dto';
import { DeviceDetailUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateDeviceDetailPageDto } from './dto/update-page.dto';
import { DeviceDetailPageEntity } from './entities/pages-device-detail.entity';
import { DeviceDetailConfigModel } from './models/config.model';
import { PAGES_DEVICE_DETAIL_PLUGIN_NAME, PAGES_DEVICE_DETAIL_TYPE } from './pages-device-detail.constants';
import { PAGES_DEVICE_DETAIL_PLUGIN_SWAGGER_EXTRA_MODELS } from './pages-device-detail.openapi';
import { PageRelationsLoaderService } from './services/page-relations-loader.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([DeviceDetailPageEntity]),
		DashboardModule,
		DevicesModule,
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
	],
	providers: [PageRelationsLoaderService],
})
export class PagesDeviceDetailPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly pagesMapper: PagesTypeMapperService,
		private readonly pageRelationsLoaderRegistryService: PageRelationsLoaderRegistryService,
		private readonly pageRelationsLoaderService: PageRelationsLoaderService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<DeviceDetailConfigModel, DeviceDetailUpdatePluginConfigDto>({
			type: PAGES_DEVICE_DETAIL_PLUGIN_NAME,
			class: DeviceDetailConfigModel,
			configDto: DeviceDetailUpdatePluginConfigDto,
		});

		this.pagesMapper.registerMapping<DeviceDetailPageEntity, CreateDeviceDetailPageDto, UpdateDeviceDetailPageDto>({
			type: PAGES_DEVICE_DETAIL_TYPE,
			class: DeviceDetailPageEntity,
			createDto: CreateDeviceDetailPageDto,
			updateDto: UpdateDeviceDetailPageDto,
		});

		this.pageRelationsLoaderRegistryService.register(this.pageRelationsLoaderService);

		for (const model of PAGES_DEVICE_DETAIL_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: PageEntity,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_DEVICE_DETAIL_TYPE,
			modelClass: DeviceDetailPageEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_DEVICE_DETAIL_TYPE,
			modelClass: CreateDeviceDetailPageDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_DEVICE_DETAIL_TYPE,
			modelClass: UpdateDeviceDetailPageDto,
		});

		this.extensionsService.registerPluginMetadata({
			type: PAGES_DEVICE_DETAIL_PLUGIN_NAME,
			name: 'Device Detail Page',
			description: 'Dashboard page for detailed device information and controls',
			author: 'FastyBird',
			readme: `# Device Detail Page

> Plugin · by FastyBird · platform: dashboard pages

Full-screen dashboard page that surfaces every channel and property of a single device, with controls for writable properties and live updates for the rest. The "deep dive" view a tile points to when the user wants more than a glance.

## What you get

- A complete picture of one device — every channel, every property, every sensor reading and every control on a single page
- Automatic UI per property: switches for booleans, sliders for ranged numbers, dropdowns for enums, read-only labels for sensors
- Real-time refresh so the page reflects external changes (someone flipping the physical switch, a sensor changing) without polling
- A great fallback for devices that don't yet have a custom dashboard: drop a Device Detail page and you immediately have full control

## Features

- **Full device view** — name, category, icon, connection status, last-seen timestamp
- **Channel list** — every channel grouped with its properties; collapsed by default for devices with many channels
- **Property controls** — automatic UI for writable properties (switch, slider, picker, …) using the same components the rest of the panel uses
- **Read-only sensors** — non-writable properties render as live values with their unit and label
- **Real-time updates** — values stream in over WebSocket; controls feed back through the optimistic intent layer for instant feel
- **Range / enum awareness** — sliders respect the property's declared min / max / step; pickers honour the enum format

Each page selects its target device when created — there is no global plugin configuration.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
