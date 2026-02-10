import { Expose, Transform } from 'class-transformer';
import { IsDate, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { EnergySourceType } from '../energy.constants';

@ApiSchema({ name: 'EnergyModuleDataEnergyDelta' })
@Entity('energy_module_deltas')
@Unique('UQ_energy_deltas_device_source_interval', ['deviceId', 'sourceType', 'intervalStart'])
@Index('IDX_energy_deltas_room_interval', ['roomId', 'sourceType', 'intervalStart'])
@Index('IDX_energy_deltas_device_interval', ['deviceId', 'intervalStart'])
@Index('IDX_energy_deltas_interval_end', ['intervalEnd'])
export class EnergyDeltaEntity {
	@ApiProperty({
		description: 'Unique identifier for the energy delta record.',
		type: 'string',
		format: 'uuid',
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
		readOnly: true,
	})
	@Expose()
	@IsString()
	@IsUUID()
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ApiProperty({
		name: 'device_id',
		description: 'Device that produced this energy reading.',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose({ name: 'device_id' })
	@IsUUID('4')
	@Transform(({ obj }: { obj: { device_id?: string; deviceId?: string } }) => obj.device_id ?? obj.deviceId, {
		toClassOnly: true,
	})
	@Index()
	@Column()
	deviceId: string;

	@ApiPropertyOptional({
		name: 'room_id',
		description: 'Room the device belongs to (denormalized for fast queries).',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6',
	})
	@Expose({ name: 'room_id' })
	@IsOptional()
	@IsUUID('4')
	@Transform(({ obj }: { obj: { room_id?: string; roomId?: string } }) => obj.room_id ?? obj.roomId, {
		toClassOnly: true,
	})
	@Index()
	@Column({ nullable: true, default: null })
	roomId: string | null;

	@ApiProperty({
		name: 'source_type',
		description: 'Type of energy source.',
		enum: EnergySourceType,
		example: EnergySourceType.CONSUMPTION_IMPORT,
	})
	@Expose({ name: 'source_type' })
	@IsEnum(EnergySourceType)
	@Transform(
		({ obj }: { obj: { source_type?: EnergySourceType; sourceType?: EnergySourceType } }) =>
			obj.source_type ?? obj.sourceType,
		{ toClassOnly: true },
	)
	@Column({ type: 'text', enum: EnergySourceType })
	sourceType: EnergySourceType;

	@ApiProperty({
		name: 'delta_kwh',
		description: 'Energy delta for this interval in kWh.',
		type: 'number',
		format: 'float',
		example: 0.125,
	})
	@Expose({ name: 'delta_kwh' })
	@IsNumber()
	@Transform(({ obj }: { obj: { delta_kwh?: number; deltaKwh?: number } }) => obj.delta_kwh ?? obj.deltaKwh, {
		toClassOnly: true,
	})
	@Column({ type: 'real' })
	deltaKwh: number;

	@ApiProperty({
		name: 'interval_start',
		description: 'Start of the time interval.',
		type: 'string',
		format: 'date-time',
		example: '2026-02-09T12:00:00Z',
	})
	@Expose({ name: 'interval_start' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { interval_start?: string | Date; intervalStart?: string | Date } }) => {
			const value: string | Date = obj.interval_start || obj.intervalStart;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	@Column({ type: 'datetime' })
	intervalStart: Date | string;

	@ApiProperty({
		name: 'interval_end',
		description: 'End of the time interval.',
		type: 'string',
		format: 'date-time',
		example: '2026-02-09T12:05:00Z',
	})
	@Expose({ name: 'interval_end' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { interval_end?: string | Date; intervalEnd?: string | Date } }) => {
			const value: string | Date = obj.interval_end || obj.intervalEnd;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	@Column({ type: 'datetime' })
	intervalEnd: Date | string;

	@ApiProperty({
		name: 'created_at',
		description: 'The timestamp when this record was created.',
		type: 'string',
		format: 'date-time',
		example: '2026-02-09T12:00:00Z',
		readOnly: true,
	})
	@Expose({ name: 'created_at' })
	@IsDate()
	@Transform(
		({ obj }: { obj: { created_at?: string | Date; createdAt?: string | Date } }) => {
			const value: string | Date = obj.created_at || obj.createdAt;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	@Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
	createdAt: Date | string;
}
