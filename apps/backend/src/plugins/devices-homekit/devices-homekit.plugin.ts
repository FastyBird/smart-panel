import { BadRequestException, Module, OnModuleInit } from '@nestjs/common';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginConfigMutationRegistryService } from '../../modules/config/services/plugin-config-mutation-registry.service';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { DevicesService } from '../../modules/devices/services/devices.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../../modules/extensions/services/managed-service-manager.service';
import { SpacesModule } from '../../modules/spaces/spaces.module';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { HomeKitBridgeController } from './controllers/homekit-bridge.controller';
import {
	DEVICES_HOMEKIT_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_HOMEKIT_PLUGIN_API_TAG_NAME,
	DEVICES_HOMEKIT_PLUGIN_NAME,
	HOMEKIT_MAX_BRIDGED_ACCESSORIES,
} from './devices-homekit.constants';
import { DEVICES_HOMEKIT_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-homekit.openapi';
import { HomeKitUpdatePluginConfigDto } from './dto/update-config.dto';
import { HomeKitEventListener } from './listeners/homekit-event.listener';
import { HomeKitConfigModel } from './models/config.model';
import { HomeKitActionsService } from './services/homekit-actions.service';
import { HomeKitBridgeService } from './services/homekit-bridge.service';
import { HomeKitCommandDispatcher } from './services/homekit-command.dispatcher';
import { HomeKitMapperRegistryService } from './services/homekit-mapper-registry.service';
import { HomeKitWizardService } from './services/homekit-wizard.service';

@ApiTag({
	tagName: DEVICES_HOMEKIT_PLUGIN_NAME,
	displayName: DEVICES_HOMEKIT_PLUGIN_API_TAG_NAME,
	description: DEVICES_HOMEKIT_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [ConfigModule, DevicesModule, ExtensionsModule, SpacesModule, SwaggerModule],
	controllers: [HomeKitBridgeController],
	providers: [
		HomeKitActionsService,
		HomeKitBridgeService,
		HomeKitCommandDispatcher,
		HomeKitEventListener,
		HomeKitMapperRegistryService,
		HomeKitWizardService,
	],
	exports: [HomeKitBridgeService],
})
export class DevicesHomeKitPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly managedServiceManager: ManagedServiceManagerService,
		private readonly homeKitBridgeService: HomeKitBridgeService,
		private readonly pluginConfigMutations: PluginConfigMutationRegistryService,
		private readonly devicesService: DevicesService,
		private readonly mapperRegistry: HomeKitMapperRegistryService,
	) {}

	onModuleInit() {
		// Register configuration schema mapping
		this.configMapper.registerMapping<HomeKitConfigModel, HomeKitUpdatePluginConfigDto>({
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			class: HomeKitConfigModel,
			configDto: HomeKitUpdatePluginConfigDto,
		});

		// Register config mutation validator and post-commit bridge reconciler
		this.pluginConfigMutations.register<HomeKitUpdatePluginConfigDto>(
			DEVICES_HOMEKIT_PLUGIN_NAME,
			async (update, commit) => {
				if (update.mapped_device_ids !== undefined) {
					if (!Array.isArray(update.mapped_device_ids)) {
						throw new BadRequestException([{ field: 'mapped_device_ids', reason: 'Device IDs must be an array.' }]);
					}

					if (update.mapped_device_ids.length > HOMEKIT_MAX_BRIDGED_ACCESSORIES) {
						throw new BadRequestException([
							{
								field: 'mapped_device_ids',
								reason: 'Maximum 149 accessories can be bridged to a single HomeKit bridge.',
							},
						]);
					}

					const unique = new Set(update.mapped_device_ids);
					if (unique.size !== update.mapped_device_ids.length) {
						throw new BadRequestException([{ field: 'mapped_device_ids', reason: 'Device IDs must be unique.' }]);
					}

					const devices = await Promise.all(
						update.mapped_device_ids.map(async (deviceId) => {
							const device = await this.devicesService.findOne(deviceId);
							return { deviceId, device };
						}),
					);

					for (const { deviceId, device } of devices) {
						if (!device) {
							throw new BadRequestException([{ field: 'mapped_device_ids', reason: `Device ${deviceId} not found.` }]);
						}

						if (!this.mapperRegistry.canMap(device)) {
							throw new BadRequestException([
								{
									field: 'mapped_device_ids',
									reason: `Device "${device.name}" (${deviceId}) is not compatible with HomeKit.`,
								},
							]);
						}
					}
				}

				await commit();

				if (update.mapped_device_ids !== undefined) {
					await this.homeKitBridgeService.reconcileLatestMapping();
				}
			},
		);

		// Register Swagger models
		for (const model of DEVICES_HOMEKIT_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register plugin metadata for extension discovery
		this.extensionsService.registerPluginMetadata({
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			name: 'Apple HomeKit Bridge',
			description: 'Bridge Smart Panel devices to Apple Home via HomeKit Accessory Protocol',
			author: 'FastyBird',
			readme: `# Apple HomeKit Bridge
> Plugin · by FastyBird · platform: devices

Exposes Smart Panel registered devices to Apple Home as bridged accessories over the local network.

## Features
- **Local Control**: Direct local connection via HomeKit Accessory Protocol (HAP) and mDNS.
- **Selective Bridging**: Select exactly which devices are exposed to Apple Home via the mapping wizard.
- **Bidirectional Sync**: Real-time push updates for lights, switches, outlets, thermostats, sensors, blinds, and locks.
- **Easy Pairing**: Scan the generated QR code or enter the 8-digit setup PIN code directly in the Apple Home app.
`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register bridge service with the managed extension service manager
		this.managedServiceManager.register(this.homeKitBridgeService);
	}
}
