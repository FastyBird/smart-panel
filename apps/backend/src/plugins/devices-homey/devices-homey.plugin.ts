import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { CreateChannelPropertyDto } from '../../modules/devices/dto/create-channel-property.dto';
import { CreateChannelDto } from '../../modules/devices/dto/create-channel.dto';
import { CreateDeviceDto } from '../../modules/devices/dto/create-device.dto';
import { UpdateChannelPropertyDto } from '../../modules/devices/dto/update-channel-property.dto';
import { UpdateChannelDto } from '../../modules/devices/dto/update-channel.dto';
import { UpdateDeviceDto } from '../../modules/devices/dto/update-device.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../modules/devices/entities/devices.entity';
import { ChannelsTypeMapperService } from '../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../modules/devices/services/channels.properties-type-mapper.service';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { PlatformRegistryService } from '../../modules/devices/services/platform.registry.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { PluginServiceManagerService } from '../../modules/extensions/services/plugin-service-manager.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';
import { FactoryResetRegistryService } from '../../modules/system/services/factory-reset-registry.service';
import { UserLifecycleMutationRegistryService } from '../../modules/users/services/user-lifecycle-mutation-registry.service';
import { UsersModule } from '../../modules/users/users.module';

import { HomeyCloudConnectorFactory } from './connectors/homey-cloud-connector.factory';
import { HomeyLocalConnectorFactory } from './connectors/homey-local-connector.factory';
import { HomeyRuntimeConnectorFactory } from './connectors/homey-runtime-connector.factory';
import { HomeySdkClientFactoryService } from './connectors/homey-sdk.client';
import { HomeyAdoptionController } from './controllers/homey-adoption.controller';
import { HomeyCloudAuthorizationController } from './controllers/homey-cloud-authorization.controller';
import { HomeyDevicesController } from './controllers/homey-devices.controller';
import { HomeyMappingPreviewController } from './controllers/homey-mapping-preview.controller';
import { HomeyStatusController } from './controllers/homey-status.controller';
import { HomeyTestConnectionController } from './controllers/homey-test-connection.controller';
import {
	DEVICES_HOMEY_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_HOMEY_PLUGIN_API_TAG_NAME,
	DEVICES_HOMEY_PLUGIN_NAME,
	DEVICES_HOMEY_TYPE,
	HOMEY_CONNECTOR_FACTORY,
} from './devices-homey.constants';
import { DEVICES_HOMEY_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-homey.openapi';
import { CreateHomeyChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateHomeyChannelDto } from './dto/create-channel.dto';
import { CreateHomeyDeviceDto } from './dto/create-device.dto';
import { UpdateHomeyChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateHomeyChannelDto } from './dto/update-channel.dto';
import { HomeyUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateHomeyDeviceDto } from './dto/update-device.dto';
import { HomeyChannelEntity, HomeyChannelPropertyEntity, HomeyDeviceEntity } from './entities/devices-homey.entity';
import { HomeyAdoptionLockEntity } from './entities/homey-adoption-lock.entity';
import {
	HomeyCloudActiveGrantEntity,
	HomeyCloudAuthorizationStateEntity,
	HomeyCloudCancelledAuthorizationEntity,
	HomeyCloudPendingGrantEntity,
	HomeyCloudUserAuthorityEntity,
} from './entities/homey-cloud-grant.entity';
import { HomeyMappingLoaderService } from './mappings/mapping-loader.service';
import { HomeyMappingTransformerService } from './mappings/mapping-transformer.service';
import { HomeyPropertyMappingStorageService } from './mappings/property-mapping-storage.service';
import { HomeyConfigModel } from './models/config.model';
import { HomeyDevicePlatform } from './platforms/homey-device.platform';
import { HomeyAdoptionLockService } from './services/homey-adoption-lock.service';
import { HomeyCloudAuthorizationHttpService } from './services/homey-cloud-authorization-http.service';
import { HomeyCloudAuthorizationStateService } from './services/homey-cloud-authorization-state.service';
import { HomeyCloudAuthorizationService } from './services/homey-cloud-authorization.service';
import { HomeyCloudClientConfigService } from './services/homey-cloud-client-config.service';
import { HomeyCloudCredentialCipherService } from './services/homey-cloud-credential-cipher.service';
import { HomeyCloudGrantMutationService } from './services/homey-cloud-grant-mutation.service';
import { HomeyCloudRuntimeRegistryService } from './services/homey-cloud-runtime-registry.service';
import { HomeyCloudRuntimeService } from './services/homey-cloud-runtime.service';
import { HomeyCloudSdkSessionFactoryService } from './services/homey-cloud-sdk-session.factory';
import { HomeyConfigMutationService } from './services/homey-config-mutation.service';
import { HomeyConfigValidatorService } from './services/homey-config-validator.service';
import { HomeyConnectionTestService } from './services/homey-connection-test.service';
import { HomeyDeviceAdoptionService } from './services/homey-device-adoption.service';
import { HomeyDeviceInventoryService } from './services/homey-device-inventory.service';
import { HomeyLegacyCloudConfigMigrationService } from './services/homey-legacy-cloud-config-migration.service';
import { HomeyMappingPreviewService } from './services/homey-mapping-preview.service';
import { HomeySynchronizerService } from './services/homey-synchronizer.service';
import { HomeyService } from './services/homey.service';

@ApiTag({
	tagName: DEVICES_HOMEY_PLUGIN_NAME,
	displayName: DEVICES_HOMEY_PLUGIN_API_TAG_NAME,
	description: DEVICES_HOMEY_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		NestConfigModule,
		TypeOrmModule.forFeature([
			HomeyDeviceEntity,
			HomeyChannelEntity,
			HomeyChannelPropertyEntity,
			HomeyAdoptionLockEntity,
			HomeyCloudAuthorizationStateEntity,
			HomeyCloudUserAuthorityEntity,
			HomeyCloudPendingGrantEntity,
			HomeyCloudCancelledAuthorizationEntity,
			HomeyCloudActiveGrantEntity,
		]),
		DevicesModule,
		ConfigModule,
		ExtensionsModule,
		SwaggerModule,
		UsersModule,
	],
	providers: [
		HomeyConfigValidatorService,
		HomeyConfigMutationService,
		HomeyCloudClientConfigService,
		HomeyCloudCredentialCipherService,
		HomeyCloudAuthorizationStateService,
		HomeyLegacyCloudConfigMigrationService,
		HomeyCloudGrantMutationService,
		HomeyCloudSdkSessionFactoryService,
		HomeyCloudRuntimeRegistryService,
		HomeyCloudRuntimeService,
		HomeyCloudAuthorizationService,
		HomeyCloudAuthorizationHttpService,
		HomeySdkClientFactoryService,
		HomeyLocalConnectorFactory,
		HomeyCloudConnectorFactory,
		HomeyRuntimeConnectorFactory,
		{
			provide: HOMEY_CONNECTOR_FACTORY,
			useExisting: HomeyRuntimeConnectorFactory,
		},
		HomeyConnectionTestService,
		HomeyMappingLoaderService,
		HomeyMappingTransformerService,
		HomeyPropertyMappingStorageService,
		HomeyDeviceInventoryService,
		HomeyMappingPreviewService,
		HomeyAdoptionLockService,
		HomeyDeviceAdoptionService,
		HomeySynchronizerService,
		HomeyService,
		HomeyDevicePlatform,
	],
	controllers: [
		HomeyCloudAuthorizationController,
		HomeyStatusController,
		HomeyTestConnectionController,
		HomeyDevicesController,
		HomeyMappingPreviewController,
		HomeyAdoptionController,
	],
	exports: [
		HomeyMappingLoaderService,
		HomeyMappingTransformerService,
		HomeyPropertyMappingStorageService,
		HomeyDeviceInventoryService,
		HomeyMappingPreviewService,
		HomeyDeviceAdoptionService,
		HomeySynchronizerService,
		HomeyService,
		HomeyCloudAuthorizationService,
		HomeyCloudSdkSessionFactoryService,
	],
})
export class DevicesHomeyPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
		private readonly pluginServiceManager: PluginServiceManagerService,
		private readonly homeyService: HomeyService,
		private readonly platformRegistry: PlatformRegistryService,
		private readonly homeyDevicePlatform: HomeyDevicePlatform,
		private readonly userLifecycleMutations: UserLifecycleMutationRegistryService,
		private readonly homeyCloudGrantMutations: HomeyCloudGrantMutationService,
		private readonly legacyCloudConfigMigration: HomeyLegacyCloudConfigMigrationService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
	) {}

	onModuleInit(): void {
		this.userLifecycleMutations.registerParticipant(this.homeyCloudGrantMutations);
		this.factoryResetRegistry.register(
			DEVICES_HOMEY_PLUGIN_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				try {
					await this.homeyService.stop();
					await this.homeyCloudGrantMutations.resetForFactory();

					return { success: true };
				} catch (error) {
					return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
				}
			},
			// Clear provider credentials before the core Devices and Users reset handlers.
			190,
		);

		this.configMapper.registerMapping<HomeyConfigModel, HomeyUpdatePluginConfigDto>({
			type: DEVICES_HOMEY_PLUGIN_NAME,
			class: HomeyConfigModel,
			configDto: HomeyUpdatePluginConfigDto,
			secretFields: [
				{
					path: 'api_key',
					configuredPath: 'api_key_configured',
					inputPaths: ['apiKey'],
				},
				{
					path: 'cloud_client_secret',
					configuredPath: 'cloud_client_secret_configured',
					inputPaths: ['cloudClientSecret'],
				},
			],
		});
		// Module initialization completes before imported managed services enter
		// application bootstrap, so legacy credentials are available when Homey
		// grant reconciliation and service enablement first inspect configuration.
		this.legacyCloudConfigMigration.migrate();

		this.devicesMapper.registerMapping<HomeyDeviceEntity, CreateHomeyDeviceDto, UpdateHomeyDeviceDto>({
			type: DEVICES_HOMEY_TYPE,
			class: HomeyDeviceEntity,
			createDto: CreateHomeyDeviceDto,
			updateDto: UpdateHomeyDeviceDto,
		});

		this.channelsMapper.registerMapping<HomeyChannelEntity, CreateHomeyChannelDto, UpdateHomeyChannelDto>({
			type: DEVICES_HOMEY_TYPE,
			class: HomeyChannelEntity,
			createDto: CreateHomeyChannelDto,
			updateDto: UpdateHomeyChannelDto,
		});

		this.channelsPropertiesMapper.registerMapping<
			HomeyChannelPropertyEntity,
			CreateHomeyChannelPropertyDto,
			UpdateHomeyChannelPropertyDto
		>({
			type: DEVICES_HOMEY_TYPE,
			class: HomeyChannelPropertyEntity,
			createDto: CreateHomeyChannelPropertyDto,
			updateDto: UpdateHomeyChannelPropertyDto,
		});

		for (const model of DEVICES_HOMEY_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.registerDiscriminator(DeviceEntity, HomeyDeviceEntity);
		this.registerDiscriminator(CreateDeviceDto, CreateHomeyDeviceDto);
		this.registerDiscriminator(UpdateDeviceDto, UpdateHomeyDeviceDto);
		this.registerDiscriminator(ChannelEntity, HomeyChannelEntity);
		this.registerDiscriminator(CreateChannelDto, CreateHomeyChannelDto);
		this.registerDiscriminator(UpdateChannelDto, UpdateHomeyChannelDto);
		this.registerDiscriminator(ChannelPropertyEntity, HomeyChannelPropertyEntity);
		this.registerDiscriminator(CreateChannelPropertyDto, CreateHomeyChannelPropertyDto);
		this.registerDiscriminator(UpdateChannelPropertyDto, UpdateHomeyChannelPropertyDto);

		this.extensionsService.registerPluginMetadata({
			type: DEVICES_HOMEY_PLUGIN_NAME,
			name: 'Homey',
			description: 'Imports and synchronizes logical devices managed by Homey',
			author: 'FastyBird',
			defaultEnabled: false,
			readme: `# Homey

> Plugin · by FastyBird · platform: devices

Connects Smart Panel to Homey Self-Hosted Server, compatible Homey Pro local APIs, or Homey Cloud. Homey remains responsible for pairing, radio networks, drivers and apps; Smart Panel adopts selected logical devices for display and control.

Local and Cloud provider settings are managed in the Smart Panel admin application. Secret fields are write-only and are never returned by the API.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		this.pluginServiceManager.register(this.homeyService);
		this.platformRegistry.register(this.homeyDevicePlatform);
	}

	private registerDiscriminator(
		parentClass: new (...args: any[]) => unknown,
		modelClass: new (...args: any[]) => unknown,
	) {
		this.discriminatorRegistry.register({
			parentClass,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_HOMEY_TYPE,
			modelClass,
		});
	}
}
