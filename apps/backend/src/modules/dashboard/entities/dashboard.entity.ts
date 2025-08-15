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

import { BaseEntity } from '../../../common/entities/base.entity';
import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { DisplayProfileEntity } from '../../system/entities/system.entity';

@Entity('dashboard_module_pages')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class PageEntity extends BaseEntity {
	@Expose()
	@IsString()
	@Column()
	title: string;

	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon?: string | null;

	@Expose()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Column({ type: 'int', default: 0 })
	order: number;

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

	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"display","reason":"Display must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [DisplayProfileEntity], {
		message: '[{"field":"display","reason":"Display must be a valid subclass of DisplayProfileEntity."}]',
	})
	@Transform(({ value }: { value: DisplayProfileEntity | null }) => value?.id ?? null, { toPlainOnly: true })
	@ManyToOne(() => DisplayProfileEntity, { cascade: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'displayId' })
	display: DisplayProfileEntity | string | null;

	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}

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

	@Expose()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Column({ type: 'int' })
	row: number;

	@Expose()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Column({ type: 'int' })
	col: number;

	@Expose({ name: 'row_span' })
	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Transform(({ obj }: { obj: { row_span?: number; rowSpan?: number } }) => obj.row_span || obj.rowSpan, {
		toClassOnly: true,
	})
	@Column({ type: 'int', nullable: false, default: 1 })
	rowSpan: number;

	@Expose({ name: 'col_span' })
	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Transform(({ obj }: { obj: { col_span?: number; colSpan?: number } }) => obj.col_span || obj.colSpan, {
		toClassOnly: true,
	})
	@Column({ type: 'int', nullable: false, default: 1 })
	colSpan: number;

	@Expose()
	@IsBoolean()
	@Column({ default: false })
	hidden: boolean;

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

	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}

	set parent(_val: unknown) {}

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

	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}

	set parent(_val: unknown) {}

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
