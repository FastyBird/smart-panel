import { Module, OnModuleInit } from '@nestjs/common';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../../modules/extensions/services/managed-service-manager.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { HomeKitBridgeController } from './controllers/homekit-bridge.controller';
import {
	DEVICES_HOMEKIT_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_HOMEKIT_PLUGIN_API_TAG_NAME,
	DEVICES_HOMEKIT_PLUGIN_NAME,
} from './devices-homekit.constants';
import { DEVICES_HOMEKIT_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-homekit.openapi';
import { HomeKitUpdatePluginConfigDto } from './dto/update-config.dto';
import { HomeKitEventListener } from './listeners/homekit-event.listener';
import { HomeKitConfigModel } from './models/config.model';
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
	imports: [ConfigModule, DevicesModule, ExtensionsModule, SwaggerModule],
	controllers: [HomeKitBridgeController],
	providers: [
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
	) {}

	onModuleInit() {
		// Register configuration schema mapping
		this.configMapper.registerMapping<HomeKitConfigModel, HomeKitUpdatePluginConfigDto>({
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			class: HomeKitConfigModel,
			configDto: HomeKitUpdatePluginConfigDto,
		});

		// Register Swagger models
		for (const model of DEVICES_HOMEKIT_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register plugin metadata for extension discovery
		this.extensionsService.registerPluginMetadata({
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			name: 'HomeKit',
			description: 'Bridge Smart Panel devices to Apple Home via HomeKit Accessory Protocol',
			author: 'FastyBird',
			readme: `# HomeKit Gateway
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
