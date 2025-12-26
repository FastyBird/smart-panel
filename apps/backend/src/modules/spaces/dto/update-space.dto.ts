import { Expose, Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, ValidateIf, ValidateNested } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { SpaceType } from '../spaces.constants';

@ApiSchema({ name: 'SpacesModuleUpdateSpace' })
export class UpdateSpaceDto {
	@ApiPropertyOptional({
		description: 'Space name',
		type: 'string',
		example: 'Living Room',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"name","reason":"Name must be a string."}]' })
	name?: string;

	@ApiPropertyOptional({
		description: 'Space description',
		type: 'string',
		nullable: true,
		example: 'Main living area on the ground floor',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"description","reason":"Description must be a string."}]' })
	@ValidateIf((_, value) => value !== null)
	description?: string | null;

	@ApiPropertyOptional({
		description: 'Space type',
		enum: SpaceType,
		example: SpaceType.ROOM,
	})
	@Expose()
	@IsOptional()
	@IsEnum(SpaceType, { message: '[{"field":"type","reason":"Type must be a valid space type."}]' })
	type?: SpaceType;

	@ApiPropertyOptional({
		description: 'Icon identifier for the space',
		type: 'string',
		nullable: true,
		example: 'mdi:sofa',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"icon","reason":"Icon must be a string."}]' })
	@ValidateIf((_, value) => value !== null)
	icon?: string | null;

	@ApiPropertyOptional({
		name: 'display_order',
		description: 'Display order for sorting spaces',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'display_order' })
	@IsOptional()
	@IsInt({ message: '[{"field":"display_order","reason":"Display order must be an integer."}]' })
	@Min(0, { message: '[{"field":"display_order","reason":"Display order must be at least 0."}]' })
	@Transform(
		({ obj }: { obj: { display_order?: number; displayOrder?: number } }) => obj.display_order ?? obj.displayOrder,
		{ toClassOnly: true },
	)
	displayOrder?: number;

	@ApiPropertyOptional({
		name: 'primary_thermostat_id',
		description: 'ID of the primary thermostat device for this space (optional admin override)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'primary_thermostat_id' })
	@IsOptional()
	@IsUUID('4', {
		message: '[{"field":"primary_thermostat_id","reason":"Primary thermostat ID must be a valid UUID."}]',
	})
	@ValidateIf((_, value) => value !== null)
	@Transform(
		({ obj }: { obj: { primary_thermostat_id?: string | null; primaryThermostatId?: string | null } }) =>
			obj.primary_thermostat_id !== undefined ? obj.primary_thermostat_id : obj.primaryThermostatId,
		{ toClassOnly: true },
	)
	primaryThermostatId?: string | null;

	@ApiPropertyOptional({
		name: 'primary_temperature_sensor_id',
		description: 'ID of the primary temperature sensor device for this space (optional admin override)',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'a2b19ca3-521e-4d7b-b3fe-bcb7a8d5b9e7',
	})
	@Expose({ name: 'primary_temperature_sensor_id' })
	@IsOptional()
	@IsUUID('4', {
		message:
			'[{"field":"primary_temperature_sensor_id","reason":"Primary temperature sensor ID must be a valid UUID."}]',
	})
	@ValidateIf((_, value) => value !== null)
	@Transform(
		({
			obj,
		}: {
			obj: { primary_temperature_sensor_id?: string | null; primaryTemperatureSensorId?: string | null };
		}) =>
			obj.primary_temperature_sensor_id !== undefined
				? obj.primary_temperature_sensor_id
				: obj.primaryTemperatureSensorId,
		{ toClassOnly: true },
	)
	primaryTemperatureSensorId?: string | null;

	@ApiPropertyOptional({
		name: 'suggestions_enabled',
		description: 'Whether suggestions are enabled for this space',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'suggestions_enabled' })
	@IsOptional()
	@IsBoolean({ message: '[{"field":"suggestions_enabled","reason":"Suggestions enabled must be a boolean."}]' })
	@Transform(
		({ obj }: { obj: { suggestions_enabled?: boolean; suggestionsEnabled?: boolean } }) =>
			obj.suggestions_enabled !== undefined ? obj.suggestions_enabled : obj.suggestionsEnabled,
		{ toClassOnly: true },
	)
	suggestionsEnabled?: boolean;
}

@ApiSchema({ name: 'SpacesModuleReqUpdateSpace' })
export class ReqUpdateSpaceDto {
	@ApiPropertyOptional({
		description: 'Space update data',
		type: () => UpdateSpaceDto,
	})
	@Expose()
	@ValidateNested()
	@Type(() => UpdateSpaceDto)
	data: UpdateSpaceDto;
}
