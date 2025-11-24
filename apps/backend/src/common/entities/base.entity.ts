import { Expose, Transform } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';
import { Column, PrimaryGeneratedColumn } from 'typeorm';

import { ApiProperty } from '@nestjs/swagger';

export abstract class BaseEntity {
	@ApiProperty({
		description: 'Unique identifier for the entity.',
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
		name: 'created_at',
		description: 'The timestamp when the entity was created.',
		type: 'string',
		format: 'date-time',
		example: '2025-01-25T12:00:00Z',
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

	@ApiProperty({
		name: 'updated_at',
		description: 'The timestamp when the entity was updated.',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2025-01-25T12:00:00Z',
		readOnly: true,
	})
	@Expose({ name: 'updated_at' })
	@IsOptional()
	@IsDate()
	@Transform(
		({ obj }: { obj: { updated_at?: string | Date; updatedAt?: string | Date } }) => {
			const value: string | Date = obj.updated_at || obj.updatedAt;
			return typeof value === 'string' ? new Date(value) : value;
		},
		{ toClassOnly: true },
	)
	@Transform(({ value }: { value: unknown }) => (value instanceof Date ? value.toISOString() : value), {
		toPlainOnly: true,
	})
	@Column({ type: 'datetime', onUpdate: 'CURRENT_TIMESTAMP', nullable: true })
	updatedAt?: Date | string;
}
