import { Expose, Transform } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';
import { Column, PrimaryGeneratedColumn } from 'typeorm';

export abstract class BaseEntity {
	@Expose()
	@IsString()
	@IsUUID()
	@PrimaryGeneratedColumn('uuid')
	id: string;

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
