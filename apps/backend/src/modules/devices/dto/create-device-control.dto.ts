import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import type { components } from '../../../openapi';
import { ApiSchema } from '../../../common/decorators/api-schema.decorator';

type ReqCreateDeviceControl = components['schemas']['DevicesModuleReqCreateDeviceControl'];
type CreateDeviceControl = components['schemas']['DevicesModuleCreateDeviceControl'];

@ApiSchema('DevicesModuleCreateDeviceControl')
export class CreateDeviceControlDto implements CreateDeviceControl {
	@ApiPropertyOptional({
		description: 'Control ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose()
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"id","reason":"ID must be a valid UUID (version 4)."}]' })
	readonly id?: string;

	@ApiProperty({ description: 'Control name', type: 'string', example: 'power' })
	@Expose()
	@IsNotEmpty({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"name","reason":"Name must be a non-empty string."}]' })
	readonly name: string;
}

@ApiSchema('DevicesModuleReqCreateDeviceControl')
export class ReqCreateDeviceControlDto implements ReqCreateDeviceControl {
	@ApiProperty({ description: 'Device control data', type: CreateDeviceControlDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateDeviceControlDto)
	data: CreateDeviceControlDto;
}
