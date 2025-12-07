import { Exclude, Expose, Transform } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Validate,
	ValidateIf,
	ValidateNested,
} from 'class-validator';
import { BeforeInsert, BeforeUpdate, Column, Entity, JoinColumn, ManyToOne, TableInheritance } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { DisplayEntity } from '../../displays/entities/displays.entity';

@ApiSchema({ name: 'DashboardModuleDataPage' })
@Entity('dashboard_module_pages')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class PageEntity extends BaseEntity {
	@ApiProperty({ description: 'Page title', type: 'string', example: 'Home' })
	@Expose()
	@IsString()
	@Column()
	title: string;

	@ApiPropertyOptional({ description: 'Page icon', type: 'string', example: 'home', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon?: string | null;

	@ApiProperty({ description: 'Display order', type: 'number', example: 0 })
	@Expose()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Column({ type: 'int', default: 0 })
	order: number;

	@ApiProperty({
		name: 'show_top_bar',
		description: 'Whether to show top bar',
		type: 'boolean',
		example: true,
	})
	@Expose({ name: 'show_top_bar' })
	@IsBoolean()
	@Column({ default: true })
	showTopBar: boolean;

	@ApiProperty({
		name: 'data_source',
		description: 'Associated data sources',
		type: 'array',
		items: { $ref: '#/components/schemas/DashboardModuleDataDataSource' },
		example: [],
	})
	@Expose({ name: 'data_source' })
	@IsArray()
	@ValidateNested({ each: true })
	@Transform(
		({ obj }: { obj: { data_source?: DataSourceEntity[]; dataSource?: DataSourceEntity[] } }) =>
			obj.data_source || obj.dataSource,
		{
			toClassOnly: true,
		},
	)
	dataSource: DataSourceEntity[] = [];

	@ApiProperty({
		description: 'Associated display ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
		nullable: true,
	})
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"display","reason":"Display must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [DisplayEntity], {
		message: '[{"field":"display","reason":"Display must be a valid subclass of DisplayEntity."}]',
	})
	@Transform(({ value }: { value: DisplayEntity | null }) => value?.id ?? null, { toPlainOnly: true })
	@ManyToOne(() => DisplayEntity, { cascade: true, onDelete: 'CASCADE', nullable: true })
	@JoinColumn({ name: 'displayId' })
	display: DisplayEntity | string | null;

	@ApiProperty({ description: 'Page type', type: 'string', example: 'default' })
	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}

@ApiSchema({ name: 'DashboardModuleDataTile' })
@Entity('dashboard_module_tiles')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class TileEntity extends BaseEntity {
	@Exclude({ toPlainOnly: true })
	@Expose({ toClassOnly: true })
	@IsString()
	@Transform(({ obj }: { obj: { parent_type?: number; parentType?: number } }) => obj.parent_type || obj.parentType, {
		toClassOnly: true,
	})
	@Column({ type: 'varchar', length: 64 })
	parentType: string;

	@Exclude({ toPlainOnly: true })
	@Expose({ toClassOnly: true })
	@IsString()
	@IsUUID()
	@Transform(({ obj }: { obj: { parent_id?: number; parentId?: number } }) => obj.parent_id || obj.parentId, {
		toClassOnly: true,
	})
	@Column({ type: 'uuid' })
	parentId: string;

	@ApiProperty({ description: 'Grid row position', type: 'number', minimum: 1, example: 1 })
	@Expose()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Column({ type: 'int' })
	row: number;

	@ApiProperty({ description: 'Grid column position', type: 'number', minimum: 1, example: 1 })
	@Expose()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Column({ type: 'int' })
	col: number;

	@ApiProperty({
		name: 'row_span',
		description: 'Number of rows the tile spans',
		type: 'number',
		minimum: 1,
		example: 1,
	})
	@Expose({ name: 'row_span' })
	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Transform(({ obj }: { obj: { row_span?: number; rowSpan?: number } }) => obj.row_span || obj.rowSpan, {
		toClassOnly: true,
	})
	@Column({ type: 'int', nullable: false, default: 1 })
	rowSpan: number;

	@ApiProperty({
		name: 'col_span',
		description: 'Number of columns the tile spans',
		type: 'number',
		minimum: 1,
		example: 1,
	})
	@Expose({ name: 'col_span' })
	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Transform(({ obj }: { obj: { col_span?: number; colSpan?: number } }) => obj.col_span || obj.colSpan, {
		toClassOnly: true,
	})
	@Column({ type: 'int', nullable: false, default: 1 })
	colSpan: number;

	@ApiProperty({ description: 'Whether tile is hidden', type: 'boolean', example: false })
	@Expose()
	@IsBoolean()
	@Column({ default: false })
	hidden: boolean;

	@ApiProperty({
		name: 'data_source',
		description: 'Associated data sources',
		type: 'array',
		items: { $ref: '#/components/schemas/DashboardModuleDataDataSource' },
		example: [],
	})
	@Expose({ name: 'data_source' })
	@IsArray()
	@ValidateNested({ each: true })
	@Transform(
		({ obj }: { obj: { data_source?: DataSourceEntity[]; dataSource?: DataSourceEntity[] } }) =>
			obj.data_source || obj.dataSource,
		{
			toClassOnly: true,
		},
	)
	dataSource: DataSourceEntity[] = [];

	@ApiProperty({ description: 'Tile type', type: 'string', example: 'default' })
	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}

	set parent(_val: unknown) {}

	@ApiProperty({
		description: 'Parent entity information',
		type: 'object',
		required: ['type', 'id'],
		properties: {
			type: { type: 'string', example: 'page' },
			id: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
		},
	})
	@Expose()
	get parent(): { type: string; id: string } {
		return {
			type: this.parentType,
			id: this.parentId,
		};
	}

	@BeforeInsert()
	@BeforeUpdate()
	validateOwnership() {
		if (!this.parentType || !this.parentId) {
			throw new Error('A tile must belong to a parent entity.');
		}
	}
}

@ApiSchema({ name: 'DashboardModuleDataDataSource' })
@Entity('dashboard_module_data_source')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class DataSourceEntity extends BaseEntity {
	@Exclude({ toPlainOnly: true })
	@Expose({ toClassOnly: true })
	@IsString()
	@Transform(({ obj }: { obj: { parent_type?: number; parentType?: number } }) => obj.parent_type || obj.parentType, {
		toClassOnly: true,
	})
	@Column({ type: 'varchar', length: 64 })
	parentType: string;

	@Exclude({ toPlainOnly: true })
	@Expose({ toClassOnly: true })
	@IsString()
	@IsUUID()
	@Transform(({ obj }: { obj: { parent_id?: number; parentId?: number } }) => obj.parent_id || obj.parentId, {
		toClassOnly: true,
	})
	@Column({ type: 'uuid' })
	parentId: string;

	@ApiProperty({ description: 'Data source type', type: 'string', example: 'device' })
	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}

	set parent(_val: unknown) {}

	@ApiProperty({
		description: 'Parent entity information',
		type: 'object',
		required: ['type', 'id'],
		properties: {
			type: { type: 'string', example: 'tile' },
			id: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
		},
	})
	@Expose()
	get parent(): { type: string; id: string } {
		return {
			type: this.parentType,
			id: this.parentId,
		};
	}

	@BeforeInsert()
	@BeforeUpdate()
	validateOwnership() {
		if (!this.parentType || !this.parentId) {
			throw new Error('A data source must belong to a parent entity.');
		}
	}
}
