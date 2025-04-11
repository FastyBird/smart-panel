import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DevicesModule } from '../../modules/devices/devices.module';
import { DevicesTypeMapperService } from '../../modules/devices/services/devices-type-mapper.service';
import { PlatformRegistryService } from '../../modules/devices/services/platform.registry.service';

import { CreateThirdPartyDeviceDto } from './dto/create-device.dto';
import { UpdateThirdPartyDeviceDto } from './dto/update-device.dto';
import { ThirdPartyDeviceEntity } from './entities/devices-third-party.entity';
import { ThirdPartyDevicePlatform } from './platforms/third-party-device.platform';

@Module({
	imports: [TypeOrmModule.forFeature([ThirdPartyDeviceEntity]), DevicesModule],
	providers: [ThirdPartyDevicePlatform],
})
export class DevicesThirdPartyPlugin {
	constructor(
		private readonly mapper: DevicesTypeMapperService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly thirdPartyDevicePlatform: ThirdPartyDevicePlatform,
	) {}

	onModuleInit() {
		this.mapper.registerMapping<ThirdPartyDeviceEntity, CreateThirdPartyDeviceDto, UpdateThirdPartyDeviceDto>({
			type: 'third-party',
			class: ThirdPartyDeviceEntity,
			createDto: CreateThirdPartyDeviceDto,
			updateDto: UpdateThirdPartyDeviceDto,
		});

		this.platformRegistryService.register(this.thirdPartyDevicePlatform);
	}
}
