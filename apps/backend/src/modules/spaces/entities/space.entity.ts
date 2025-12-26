import { Expose, Transform } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Column, Entity } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { SpaceType } from '../spaces.constants';

@ApiSchema({ name: 'SpacesModuleDataSpace' })
@Entity('spaces_module_spaces')
export class SpaceEntity extends BaseEntity {
	@ApiProperty({
		description: 'Space name',
		type: 'string',
		example: 'Living Room',
	})
	@Expose()
	@IsString()
	@Column({ nullable: false })
	name: string;

	@ApiPropertyOptional({
		description: 'Space description',
		type: 'string',
		nullable: true,
		example: 'Main living area on the ground floor',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	description: string | null;

	@ApiProperty({
		description: 'Space type',
		enum: SpaceType,
		example: SpaceType.ROOM,
	})
	@Expose()
	@IsEnum(SpaceType)
	@Column({
		type: 'varchar',
		default: SpaceType.ROOM,
	})
	type: SpaceType;

	@ApiPropertyOptional({
		description: 'Icon identifier for the space',
		type: 'string',
		nullable: true,
		example: 'mdi:sofa',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon: string | null;

	@ApiProperty({
		name: 'display_order',
		description: 'Display order for sorting spaces',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'display_order' })
	@IsInt()
	@Min(0)
	@Transform(
		({ obj }: { obj: { display_order?: number; displayOrder?: number } }) => obj.display_order ?? obj.displayOrder,
		{ toClassOnly: true },
	)
	@Column({ type: 'int', default: 0 })
	displayOrder: number;

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
	@IsUUID('4')
	@Transform(
		({ obj }: { obj: { primary_thermostat_id?: string | null; primaryThermostatId?: string | null } }) =>
			obj.primary_thermostat_id ?? obj.primaryThermostatId,
		{ toClassOnly: true },
	)
	@Column({ nullable: true, default: null })
	primaryThermostatId: string | null;

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
	@IsUUID('4')
	@Transform(
		({ obj }: { obj: { primary_temperature_sensor_id?: string | null; primaryTemperatureSensorId?: string | null } }) =>
			obj.primary_temperature_sensor_id ?? obj.primaryTemperatureSensorId,
		{ toClassOnly: true },
	)
	@Column({ nullable: true, default: null })
	primaryTemperatureSensorId: string | null;

	@ApiProperty({
		name: 'suggestions_enabled',
		description: 'Whether suggestions are enabled for this space',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'suggestions_enabled' })
	@Transform(
		({ obj }: { obj: { suggestions_enabled?: boolean; suggestionsEnabled?: boolean } }) =>
			obj.suggestions_enabled ?? obj.suggestionsEnabled,
		{ toClassOnly: true },
	)
	@Column({ type: 'boolean', default: true })
	suggestionsEnabled: boolean;

	@ApiPropertyOptional({
		name: 'last_activity_at',
		description: 'The timestamp of the last device activity in this space',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2025-01-25T12:00:00Z',
		readOnly: true,
	})
	@Expose({ name: 'last_activity_at' })
	@IsOptional()
	@IsDate()
	@Transform(
		({ obj }: { obj: { last_activity_at?: string | Date; lastActivityAt?: string | Date } }) => {
			const value: string | Date | undefined = obj.last_activity_at ?? obj.lastActivityAt;
			if (!value) return null;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	@Column({ type: 'datetime', nullable: true, default: null })
	lastActivityAt: Date | string | null;
}
