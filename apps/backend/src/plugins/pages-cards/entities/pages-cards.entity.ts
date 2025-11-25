import { Expose, Transform, Type } from 'class-transformer';
import {
	IsArray,
	IsInstance,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	ValidateIf,
	ValidateNested,
} from 'class-validator';
import { ChildEntity, Column, Entity, ManyToOne, OneToMany } from 'typeorm';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { DataSourceEntity, PageEntity, TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { PAGES_CARDS_TYPE } from '../pages-cards.constants';

@ApiSchema({ name: 'PagesCardsPluginCardsPage' })
@ChildEntity()
export class CardsPageEntity extends PageEntity {
	@ApiProperty({
		description: 'Page cards',
		type: 'array',
		items: { type: 'object' },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CardEntity)
	@OneToMany(() => CardEntity, (card) => card.page, { cascade: true, onDelete: 'CASCADE' })
	cards: CardEntity[];

	@ApiProperty({
		description: 'Page type',
		type: 'string',
		example: PAGES_CARDS_TYPE,
	})
	@Expose()
	get type(): string {
		return PAGES_CARDS_TYPE;
	}
}

@ApiSchema({ name: 'PagesCardsPluginCard' })
@Entity('dashboard_module_cards')
export class CardEntity extends BaseEntity {
	@ApiProperty({
		description: 'Card title',
		type: 'string',
		example: 'Living Room',
	})
	@Expose()
	@IsString()
	@Column()
	title: string;

	@ApiProperty({
		description: 'Card icon name',
		type: 'string',
		nullable: true,
		example: 'mdi-home',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ nullable: true, default: null })
	icon?: string | null;

	@ApiProperty({
		description: 'Card order position',
		type: 'number',
		example: 1,
	})
	@Expose()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Column({ type: 'int', default: 0 })
	order: number;

	@ApiProperty({
		description: 'Page identifier',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
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

	@ApiProperty({
		description: 'Card tiles',
		type: 'array',
		items: { type: 'object' },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	tiles: TileEntity[] = [];

	@ApiProperty({
		description: 'Card data sources',
		name: 'data_source',
		type: 'array',
		items: { type: 'object' },
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
}
