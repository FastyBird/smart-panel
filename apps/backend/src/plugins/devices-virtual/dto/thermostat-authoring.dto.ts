import { Expose, Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { CreateVirtualDeviceDto } from './create-device.dto';
import { ConfigureVirtualThermostatDto } from './thermostat-config.dto';

@ApiSchema({ name: 'DevicesVirtualPluginCreateThermostatProducer' })
export class CreateVirtualThermostatProducerDto {
	@ApiProperty({
		description: 'Complete proposed climate-controller thermostat graph with explicit UUIDs',
		type: CreateVirtualDeviceDto,
	})
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => CreateVirtualDeviceDto)
	device: CreateVirtualDeviceDto;

	@ApiProperty({
		description: 'Versioned thermostat policy, source, claim and setting registrations',
		type: ConfigureVirtualThermostatDto,
	})
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => ConfigureVirtualThermostatDto)
	configuration: ConfigureVirtualThermostatDto;
}
