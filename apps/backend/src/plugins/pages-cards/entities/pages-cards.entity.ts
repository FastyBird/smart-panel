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

import { BaseEntity } from '../../../common/entities/base.entity';
import { DataSourceEntity, PageEntity, TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { PAGES_CARDS_TYPE } from '../pages-cards.constants';

@ChildEntity()
export class CardsPageEntity extends PageEntity {
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CardEntity)
	@OneToMany(() => CardEntity, (card) => card.page, { cascade: true, onDelete: 'CASCADE' })
	cards: CardEntity[];

	@Expose()
	get type(): string {
		return PAGES_CARDS_TYPE;
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
	icon?: string | null;

	@Expose()
	@IsNumber({ allowNaN: false, allowInfinity: false }, { each: false })
	@Column({ type: 'int', default: 0 })
	order: number;

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
	tiles: TileEntity[] = [];

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
