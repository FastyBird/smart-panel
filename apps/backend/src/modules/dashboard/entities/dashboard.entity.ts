import { Expose, Transform, Type, instanceToPlain } from 'class-transformer';
import {
	IsArray,
	IsInstance,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Validate,
	ValidateIf,
	ValidateNested,
} from 'class-validator';
import {
	BeforeInsert,
	BeforeUpdate,
	ChildEntity,
	Column,
	Entity,
	ManyToOne,
	OneToMany,
	TableInheritance,
} from 'typeorm';

import { BaseEntity } from '../../../common/entities/base.entity';
import { AbstractInstanceValidator } from '../../../common/validation/abstract-instance.validator';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';

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
	icon?: string | null = null;

	@Expose()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Column({ type: 'int', default: 0 })
	order: number = 0;

	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}
}

@ChildEntity()
export class CardsPageEntity extends PageEntity {
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CardEntity)
	@Transform(
		({ value }: { value: CardEntity[] }) => value?.map((tile) => instanceToPlain(tile, { exposeUnsetFields: false })),
		{ toPlainOnly: true },
	)
	@OneToMany(() => CardEntity, (card) => card.page, { cascade: true, onDelete: 'CASCADE' })
	cards: CardEntity[];

	@Expose({ name: 'data_source' })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => DataSourceEntity)
	@Transform(
		({ obj }: { obj: { data_source?: DataSourceEntity[]; dataSource?: DataSourceEntity[] } }) =>
			obj.data_source || obj.dataSource,
		{
			toClassOnly: true,
		},
	)
	@Transform(
		({ value }: { value: DataSourceEntity[] }) =>
			value?.map((dataSource) => instanceToPlain(dataSource, { exposeUnsetFields: false })),
		{
			toPlainOnly: true,
		},
	)
	@OneToMany(() => DataSourceEntity, (dataSource) => dataSource.page, {
		cascade: true,
		onDelete: 'CASCADE',
		eager: true,
	})
	dataSource: DataSourceEntity[];

	@Expose()
	get type(): string {
		return 'cards';
	}
}

@ChildEntity()
export class TilesPageEntity extends PageEntity {
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => TileEntity)
	@Transform(
		({ value }: { value: TileEntity[] }) => value?.map((tile) => instanceToPlain(tile, { exposeUnsetFields: false })),
		{ toPlainOnly: true },
	)
	@OneToMany(() => TileEntity, (tile) => tile.page, { cascade: true, onDelete: 'CASCADE' })
	tiles: TileEntity[];

	@Expose({ name: 'data_source' })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => DataSourceEntity)
	@Transform(
		({ obj }: { obj: { data_source?: DataSourceEntity[]; dataSource?: DataSourceEntity[] } }) =>
			obj.data_source || obj.dataSource,
		{
			toClassOnly: true,
		},
	)
	@Transform(
		({ value }: { value: DataSourceEntity[] }) =>
			value?.map((dataSource) => instanceToPlain(dataSource, { exposeUnsetFields: false })),
		{
			toPlainOnly: true,
		},
	)
	@OneToMany(() => DataSourceEntity, (dataSource) => dataSource.page, {
		cascade: true,
		onDelete: 'CASCADE',
		eager: true,
	})
	dataSource: DataSourceEntity[];

	@Expose()
	get type(): string {
		return 'tiles';
	}
}

@ChildEntity()
export class DeviceDetailPageEntity extends PageEntity {
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [DeviceEntity], {
		message: '[{"field":"device","reason":"Device must be a valid subclass of DeviceEntity."}]',
	})
	@Transform(({ value }: { value: DeviceEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => DeviceEntity, { onDelete: 'CASCADE' })
	device: DeviceEntity | string;

	@Expose()
	get type(): string {
		return 'device-detail';
	}
}

@Entity('dashboard_module_cards')
export class CardEntity extends BaseEntity {
	@Expose()
	@IsString()
	@Column()
	title: string;

	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon?: string | null = null;

	@Expose()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Column({ type: 'int', default: 0 })
	order: number = 0;

	@Expose()
	@IsOptional()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"page","reason":"Page must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof CardsPageEntity)
	@IsInstance(CardsPageEntity, { message: '[{"field":"page","reason":"Page must be a valid CardsPageEntity."}]' })
	@Transform(({ value }: { value: CardsPageEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => CardsPageEntity, (page: CardsPageEntity) => page.cards, {
		onDelete: 'CASCADE',
		eager: true,
	})
	page: CardsPageEntity | string | null;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => TileEntity)
	@Transform(
		({ value }: { value: TileEntity[] }) => value?.map((tile) => instanceToPlain(tile, { exposeUnsetFields: false })),
		{ toPlainOnly: true },
	)
	@OneToMany(() => TileEntity, (tile) => tile.card, { cascade: true, onDelete: 'CASCADE' })
	tiles: TileEntity[];

	@Expose({ name: 'data_source' })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => DataSourceEntity)
	@Transform(
		({ obj }: { obj: { data_source?: DataSourceEntity[]; dataSource?: DataSourceEntity[] } }) =>
			obj.data_source || obj.dataSource,
		{
			toClassOnly: true,
		},
	)
	@Transform(
		({ value }: { value: DataSourceEntity[] }) =>
			value?.map((dataSource) => instanceToPlain(dataSource, { exposeUnsetFields: false })),
		{
			toPlainOnly: true,
		},
	)
	@OneToMany(() => DataSourceEntity, (dataSource) => dataSource.card, {
		cascade: true,
		onDelete: 'CASCADE',
		eager: true,
	})
	dataSource: DataSourceEntity[];
}

@Entity('dashboard_module_tiles')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class TileEntity extends BaseEntity {
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"page","reason":"Page must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof TilesPageEntity)
	@IsInstance(TilesPageEntity, { message: '[{"field":"page","reason":"Page must be a valid TilesPageEntity."}]' })
	@Transform(
		({ value }: { value: TilesPageEntity | string | null }) =>
			value ? (typeof value === 'string' ? value : value.id) : undefined,
		{
			toPlainOnly: true,
		},
	)
	@ManyToOne(() => TilesPageEntity, (page: TilesPageEntity) => page.tiles, {
		onDelete: 'CASCADE',
		eager: true,
	})
	page: TilesPageEntity | string | null;

	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"card","reason":"Card must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof CardEntity)
	@IsInstance(CardEntity, { message: '[{"field":"card","reason":"Card must be a valid CardEntity."}]' })
	@Transform(
		({ value }: { value: CardEntity | string | null }) =>
			value ? (typeof value === 'string' ? value : value.id) : undefined,
		{
			toPlainOnly: true,
		},
	)
	@ManyToOne(() => CardEntity, (card: CardEntity) => card.tiles, {
		onDelete: 'CASCADE',
		eager: true,
	})
	card: CardEntity | string | null;

	@Expose({ name: 'data_source' })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => DataSourceEntity)
	@Transform(
		({ obj }: { obj: { data_source?: DataSourceEntity[]; dataSource?: DataSourceEntity[] } }) =>
			obj.data_source || obj.dataSource,
		{
			toClassOnly: true,
		},
	)
	@Transform(
		({ value }: { value: DataSourceEntity[] }) =>
			value?.map((dataSource) => instanceToPlain(dataSource, { exposeUnsetFields: false })),
		{
			toPlainOnly: true,
		},
	)
	@OneToMany(() => DataSourceEntity, (dataSource) => dataSource.tile, {
		cascade: true,
		onDelete: 'CASCADE',
		eager: true,
	})
	dataSource: DataSourceEntity[];

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
	@Column({ type: 'int', nullable: false, default: 0 })
	rowSpan?: number = 0;

	@Expose({ name: 'col_span' })
	@IsOptional()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Transform(({ obj }: { obj: { col_span?: number; colSpan?: number } }) => obj.col_span || obj.colSpan, {
		toClassOnly: true,
	})
	@Column({ type: 'int', nullable: false, default: 0 })
	colSpan?: number = 0;

	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}

	@BeforeInsert()
	@BeforeUpdate()
	validateOwnership() {
		const assigned = [this.page, this.card].filter(Boolean).length;

		if (assigned === 0) {
			throw new Error('A tile must belong to either a page or card.');
		}

		if (assigned > 1) {
			throw new Error('A tile cannot belong to multiple entities at the same time.');
		}
	}
}

@ChildEntity()
export class DevicePreviewTileEntity extends TileEntity {
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [DeviceEntity], {
		message: '[{"field":"device","reason":"Device must be a valid subclass of DeviceEntity."}]',
	})
	@Transform(({ value }: { value: DeviceEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => DeviceEntity, { onDelete: 'CASCADE', eager: true })
	device: DeviceEntity | string;

	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon?: string | null = null;

	@Expose()
	get type(): string {
		return 'device-preview';
	}
}

@ChildEntity()
export class TimeTileEntity extends TileEntity {
	@Expose()
	get type(): string {
		return 'clock';
	}
}

@ChildEntity()
export class DayWeatherTileEntity extends TileEntity {
	@Expose()
	get type(): string {
		return 'weather-day';
	}
}

@ChildEntity()
export class ForecastWeatherTileEntity extends TileEntity {
	@Expose()
	get type(): string {
		return 'weather-forecast';
	}
}

@Entity('dashboard_module_data_source')
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class DataSourceEntity extends BaseEntity {
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"page","reason":"Page must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [PageEntity], {
		message: '[{"field":"page","reason":"Page must be a valid PageEntity."}]',
	})
	@Transform(
		({ value }: { value: PageEntity | string | null }) =>
			value ? (typeof value === 'string' ? value : value.id) : undefined,
		{
			toPlainOnly: true,
		},
	)
	@ManyToOne(() => PageEntity, (page: CardsPageEntity | TilesPageEntity) => page.dataSource, { onDelete: 'CASCADE' })
	page: CardsPageEntity | TilesPageEntity | string | null;

	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"tile","reason":"Tile must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [TileEntity], {
		message: '[{"field":"tile","reason":"Tile must be a valid TileEntity."}]',
	})
	@Transform(
		({ value }: { value: TileEntity | string | null }) =>
			value ? (typeof value === 'string' ? value : value.id) : undefined,
		{
			toPlainOnly: true,
		},
	)
	@ManyToOne(() => TileEntity, (tile) => tile.dataSource, { onDelete: 'CASCADE' })
	tile: TileEntity | string | null;

	@Expose()
	@IsString()
	@Type(() => CardEntity)
	@Transform(
		({ value }: { value: CardEntity | string | null }) =>
			value ? (typeof value === 'string' ? value : value.id) : undefined,
		{
			toPlainOnly: true,
		},
	)
	@ManyToOne(() => CardEntity, (card) => card.dataSource, { onDelete: 'CASCADE' })
	card: CardEntity | string | null;

	@Expose()
	get type(): string {
		const constructorName = (this.constructor as { name: string }).name;
		return constructorName.toLowerCase();
	}

	@BeforeInsert()
	@BeforeUpdate()
	validateOwnership() {
		const assigned = [this.page, this.tile, this.card].filter(Boolean).length;

		if (assigned === 0) {
			throw new Error('A data source must belong to either a page, tile, or card.');
		}

		if (assigned > 1) {
			throw new Error('A data source cannot belong to multiple entities at the same time.');
		}
	}
}

@ChildEntity()
export class DeviceChannelDataSourceEntity extends DataSourceEntity {
	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"device","reason":"Device must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => typeof value === 'object')
	@Validate(AbstractInstanceValidator, [DeviceEntity], {
		message: '[{"field":"device","reason":"Device must be a valid subclass of DeviceEntity."}]',
	})
	@Transform(({ value }: { value: DeviceEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => DeviceEntity, { onDelete: 'CASCADE' })
	device: DeviceEntity | string;

	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"channel","reason":"Channel must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof ChannelEntity)
	@IsInstance(ChannelEntity, { message: '[{"field":"channel","reason":"Channel must be a valid ChannelEntity."}]' })
	@Transform(({ value }: { value: ChannelEntity | string }) => (typeof value === 'string' ? value : value?.id), {
		toPlainOnly: true,
	})
	@ManyToOne(() => ChannelEntity, { onDelete: 'CASCADE' })
	channel: ChannelEntity | string;

	@Expose()
	@ValidateIf((_, value) => typeof value === 'string')
	@IsUUID('4', { message: '[{"field":"property","reason":"Property must be a valid UUID (version 4)."}]' })
	@ValidateIf((_, value) => value instanceof ChannelPropertyEntity)
	@IsInstance(ChannelPropertyEntity, {
		message: '[{"field":"property","reason":"Property must be a valid ChannelPropertyEntity."}]',
	})
	@Transform(
		({ value }: { value: ChannelPropertyEntity | string }) => (typeof value === 'string' ? value : value?.id),
		{ toPlainOnly: true },
	)
	@ManyToOne(() => ChannelPropertyEntity, { onDelete: 'CASCADE' })
	property: ChannelPropertyEntity | string;

	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon?: string | null = null;

	@Expose()
	get type(): string {
		return 'device-channel';
	}
}
