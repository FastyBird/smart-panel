import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesSimulatorPluginSimulateValue' })
export class SimulateValueDto {
	@ApiProperty({
		description: 'Property ID to simulate value for',
		name: 'property_id',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"property_id","reason":"Property ID is required."}]' })
	@IsUUID('4', { message: '[{"field":"property_id","reason":"Property ID must be a valid UUID."}]' })
	property_id: string;

	@ApiPropertyOptional({
		description: 'Specific value to set (if not provided, a random value will be generated based on property type)',
		type: 'string',
		example: 'true',
	})
	@Expose()
	@IsOptional()
	value?: string | number | boolean;
}

@ApiSchema({ name: 'DevicesSimulatorPluginReqSimulateValue' })
export class ReqSimulateValueDto {
	@ApiProperty({ description: 'Simulation data', type: () => SimulateValueDto })
	@Expose()
	@ValidateNested()
	@Type(() => SimulateValueDto)
	data: SimulateValueDto;
}

@ApiSchema({ name: 'DevicesSimulatorPluginSimulateConnectionState' })
export class SimulateConnectionStateDto {
	@ApiProperty({
		description: 'Connection state to simulate',
		type: 'string',
		enum: ['connected', 'disconnected', 'lost', 'alert', 'unknown'],
		example: 'connected',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"state","reason":"Connection state is required."}]' })
	state: 'connected' | 'disconnected' | 'lost' | 'alert' | 'unknown';
}

@ApiSchema({ name: 'DevicesSimulatorPluginReqSimulateConnectionState' })
export class ReqSimulateConnectionStateDto {
	@ApiProperty({ description: 'Connection state simulation data', type: () => SimulateConnectionStateDto })
	@Expose()
	@ValidateNested()
	@Type(() => SimulateConnectionStateDto)
	data: SimulateConnectionStateDto;
}
