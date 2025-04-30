import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DevicesModule } from '../../modules/devices/devices.module';
import { ChannelsTypeMapperService } from '../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../modules/devices/services/channels.properties-type-mapper.service';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { PlatformRegistryService } from '../../modules/devices/services/platform.registry.service';

import { CreateThirdPartyChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateThirdPartyChannelDto } from './dto/create-channel.dto';
import { CreateThirdPartyDeviceDto } from './dto/create-device.dto';
import { UpdateThirdPartyChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateThirdPartyChannelDto } from './dto/update-channel.dto';
import { UpdateThirdPartyDeviceDto } from './dto/update-device.dto';
import {
	ThirdPartyChannelEntity,
	ThirdPartyChannelPropertyEntity,
	ThirdPartyDeviceEntity,
} from './entities/devices-third-party.entity';
import { ThirdPartyDevicePlatform } from './platforms/third-party-device.platform';

@Module({
	imports: [TypeOrmModule.forFeature([ThirdPartyDeviceEntity]), DevicesModule],
	providers: [ThirdPartyDevicePlatform],
})
export class DevicesThirdPartyPlugin {
	constructor(
		private readonly devicesMapper: DevicesTypeMapperService,
		private readonly channelsMapper: ChannelsTypeMapperService,
		private readonly channelsPropertiesMapper: ChannelsPropertiesTypeMapperService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly thirdPartyDevicePlatform: ThirdPartyDevicePlatform,
	) {}

	onModuleInit() {
		this.devicesMapper.registerMapping<ThirdPartyDeviceEntity, CreateThirdPartyDeviceDto, UpdateThirdPartyDeviceDto>({
			type: 'third-party',
			class: ThirdPartyDeviceEntity,
			createDto: CreateThirdPartyDeviceDto,
			updateDto: UpdateThirdPartyDeviceDto,
		});

		this.channelsMapper.registerMapping<
			ThirdPartyChannelEntity,
			CreateThirdPartyChannelDto,
			UpdateThirdPartyChannelDto
		>({
			type: 'third-party',
			class: ThirdPartyChannelEntity,
			createDto: CreateThirdPartyChannelDto,
			updateDto: UpdateThirdPartyChannelDto,
		});

		this.channelsPropertiesMapper.registerMapping<
			ThirdPartyChannelPropertyEntity,
			CreateThirdPartyChannelPropertyDto,
			UpdateThirdPartyChannelPropertyDto
		>({
			type: 'third-party',
			class: ThirdPartyChannelPropertyEntity,
			createDto: CreateThirdPartyChannelPropertyDto,
			updateDto: UpdateThirdPartyChannelPropertyDto,
		});

		this.platformRegistryService.register(this.thirdPartyDevicePlatform);
	}
}
