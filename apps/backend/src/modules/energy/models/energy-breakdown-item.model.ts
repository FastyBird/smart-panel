import { Expose } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'EnergyModuleDataBreakdownItem' })
export class EnergyBreakdownItemModel {
	@ApiProperty({
		name: 'device_id',
		description: 'Device identifier.',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'device_id' })
	@IsUUID()
	deviceId: string;

	@ApiProperty({
		name: 'device_name',
		description: 'Device display name.',
		type: 'string',
		example: 'Kitchen Dishwasher',
	})
	@Expose({ name: 'device_name' })
	@IsString()
	deviceName: string;

	@ApiPropertyOptional({
		name: 'room_id',
		description: 'Room identifier the device belongs to.',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'room_id' })
	@IsOptional()
	@IsUUID()
	roomId: string | null;

	@ApiPropertyOptional({
		name: 'room_name',
		description: 'Room display name.',
		type: 'string',
		nullable: true,
		example: 'Kitchen',
	})
	@Expose({ name: 'room_name' })
	@IsOptional()
	@IsString()
	roomName: string | null;

	@ApiProperty({
		name: 'consumption_kwh',
		description: 'Total consumption in kWh for the requested range.',
		type: 'number',
		format: 'float',
		example: 2.35,
	})
	@Expose({ name: 'consumption_kwh' })
	@IsNumber()
	consumptionKwh: number;
}
