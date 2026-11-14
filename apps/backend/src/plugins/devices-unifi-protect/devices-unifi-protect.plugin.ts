import { Module, OnModuleInit } from '@nestjs/common';
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
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { DefaultProtectApiClientFactory, PROTECT_API_CLIENT_FACTORY } from './client/protect-api-client.factory';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_DESCRIPTION,
	DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME,
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	DEVICES_UNIFI_PROTECT_TYPE,
	PROTECT_TRUSTED_CA,
} from './devices-unifi-protect.constants';
import { DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS } from './devices-unifi-protect.openapi';
import { CreateProtectChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateProtectChannelDto } from './dto/create-channel.dto';
import { CreateProtectDeviceDto } from './dto/create-device.dto';
import { UpdateProtectChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateProtectChannelDto } from './dto/update-channel.dto';
import { ProtectUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateProtectDeviceDto } from './dto/update-device.dto';
import {
	ProtectChannelEntity,
	ProtectChannelPropertyEntity,
	ProtectDeviceEntity,
} from './entities/devices-unifi-protect.entity';
import { ProtectConfigModel } from './models/config.model';
import { ProtectConfigValidatorService } from './services/protect-config-validator.service';

@ApiTag({
	tagName: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	displayName: DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME,
	description: DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([ProtectDeviceEntity, ProtectChannelEntity, ProtectChannelPropertyEntity]),
		DevicesModule,
		ConfigModule,
		ExtensionsModule,
		SwaggerModule,
	],
	providers: [
		ProtectConfigValidatorService,
		// Tests override this extra trusted CA; production never sets it.
		{ provide: PROTECT_TRUSTED_CA, useValue: undefined },
		DefaultProtectApiClientFactory,
		{ provide: PROTECT_API_CLIENT_FACTORY, useExisting: DefaultProtectApiClientFactory },
	],
})
export class DevicesUnifiProtectPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit(): void {
		this.configMapper.registerMapping<ProtectConfigModel, ProtectUpdatePluginConfigDto>({
			type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
			class: ProtectConfigModel,
			configDto: ProtectUpdatePluginConfigDto,
			secretFields: [
				{
					path: 'api_key',
					configuredPath: 'api_key_configured',
					inputPaths: ['apiKey'],
				},
			],
		});

		this.devicesMapper.registerMapping<ProtectDeviceEntity, CreateProtectDeviceDto, UpdateProtectDeviceDto>({
			type: DEVICES_UNIFI_PROTECT_TYPE,
			class: ProtectDeviceEntity,
			createDto: CreateProtectDeviceDto,
			updateDto: UpdateProtectDeviceDto,
		});

		this.channelsMapper.registerMapping<ProtectChannelEntity, CreateProtectChannelDto, UpdateProtectChannelDto>({
			type: DEVICES_UNIFI_PROTECT_TYPE,
			class: ProtectChannelEntity,
			createDto: CreateProtectChannelDto,
			updateDto: UpdateProtectChannelDto,
		});

		this.channelsPropertiesMapper.registerMapping<
			ProtectChannelPropertyEntity,
			CreateProtectChannelPropertyDto,
			UpdateProtectChannelPropertyDto
		>({
			type: DEVICES_UNIFI_PROTECT_TYPE,
			class: ProtectChannelPropertyEntity,
			createDto: CreateProtectChannelPropertyDto,
			updateDto: UpdateProtectChannelPropertyDto,
		});

		for (const model of DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.registerDiscriminator(DeviceEntity, ProtectDeviceEntity);
		this.registerDiscriminator(CreateDeviceDto, CreateProtectDeviceDto);
		this.registerDiscriminator(UpdateDeviceDto, UpdateProtectDeviceDto);
		this.registerDiscriminator(ChannelEntity, ProtectChannelEntity);
		this.registerDiscriminator(CreateChannelDto, CreateProtectChannelDto);
		this.registerDiscriminator(UpdateChannelDto, UpdateProtectChannelDto);
		this.registerDiscriminator(ChannelPropertyEntity, ProtectChannelPropertyEntity);
		this.registerDiscriminator(CreateChannelPropertyDto, CreateProtectChannelPropertyDto);
		this.registerDiscriminator(UpdateChannelPropertyDto, UpdateProtectChannelPropertyDto);

		this.extensionsService.registerPluginMetadata({
			type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
			name: 'UniFi Protect',
			description: 'Connects Smart Panel to a UniFi Protect console over its local Integration API',
			author: 'FastyBird',
			defaultEnabled: false,
			readme: `# UniFi Protect

> Plugin · by FastyBird · platform: devices

Connects Smart Panel to a UniFi Protect console over its local Integration API. Protect remains responsible for adopting cameras, recording and firmware; Smart Panel reads the console's inventory for display.

## What you get

- Cameras, sensors and lights known to your Protect console as Smart Panel devices
- A fully local integration with no UniFi cloud account and no hosted Smart Panel bridge
- Certificate trust that never sends the API key over an unverified connection

## Setup

1. Make sure the console runs Protect 7.2.105 or newer.
2. In Protect, open Integrations and create an API key.
3. Enter the console host and the API key in this plugin's configuration.
4. Choose how the console certificate is trusted (see TLS), save and enable the plugin.

The API key is write-only: it is stored locally and never returned by the API.

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`host\` | Console host name or IP address | — |
| \`port\` | Console HTTPS port | \`443\` |
| \`api_key\` | Write-only Protect API key | — |
| \`tls.mode\` | Certificate trust mode: \`verify\` or \`pinned\` | \`verify\` |
| \`tls.server_name\` | Name used for SNI and certificate verification | — |
| \`tls.fingerprint_sha256\` | SHA-256 fingerprint of the console certificate, required for \`pinned\` | — |
| \`stream_host_override\` | Host clients use to reach camera streams instead of the console host | — |
| \`default_stream_quality\` | Preferred stream quality: \`high\`, \`medium\` or \`low\` | \`medium\` |
| \`snapshot_min_interval_ms\` | Minimum interval between snapshots of one camera (500–60000) | \`2000 ms\` |
| \`poll_interval_ms\` | Interval between inventory refreshes (5000–600000) | \`30000 ms\` |

## TLS

- \`verify\` checks the certificate chain and name. Set \`tls.server_name\` to the console's direct-connect domain, which serves a valid public certificate, or use a host name the certificate covers.
- \`pinned\` skips chain validation and accepts the console only when the SHA-256 fingerprint of its certificate equals \`tls.fingerprint_sha256\`.

There is no insecure mode: the API key is never sent over a connection that is neither name-verified nor pinned.

## Boundaries

This version only reads from the console and never changes console settings. The plugin never disables a camera microphone. Adoption, recording, users and firmware stay in Protect.

Provider settings are managed in the Smart Panel admin application. The API key is write-only and is never returned by the API.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}

	private registerDiscriminator(
		parentClass: new (...args: any[]) => unknown,
		modelClass: new (...args: any[]) => unknown,
	) {
		this.discriminatorRegistry.register({
			parentClass,
			discriminatorProperty: 'type',
			discriminatorValue: DEVICES_UNIFI_PROTECT_TYPE,
			modelClass,
		});
	}
}
