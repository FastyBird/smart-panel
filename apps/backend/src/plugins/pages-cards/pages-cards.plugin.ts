import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { PageCreateBuilderRegistryService } from '../../modules/dashboard/services/page-create-builder-registry.service';
import { PagesTypeMapperService } from '../../modules/dashboard/services/pages-type-mapper.service';

import { CardsController } from './controllers/cards.controller';
import { CreateCardsPageDto } from './dto/create-page.dto';
import { UpdateCardsPageDto } from './dto/update-page.dto';
import { CardEntity, CardsPageEntity } from './entities/pages-cards.entity';
import { CardsService } from './services/cards.service';
import { CardsPageNestedBuilderService } from './services/page-create-nested-builder.service';

@Module({
	imports: [TypeOrmModule.forFeature([CardsPageEntity, CardEntity]), DashboardModule],
	providers: [CardsService, CardsPageNestedBuilderService],
	controllers: [CardsController],
	exports: [CardsService],
})
export class PagesCardsPlugin {
	constructor(
		private readonly mapper: PagesTypeMapperService,
		private readonly pageCreateBuilderRegistryService: PageCreateBuilderRegistryService,
		private readonly cardsPageNestedBuilderService: CardsPageNestedBuilderService,
	) {}

	onModuleInit() {
		this.mapper.registerMapping<CardsPageEntity, CreateCardsPageDto, UpdateCardsPageDto>({
			type: 'cards',
			class: CardsPageEntity,
			createDto: CreateCardsPageDto,
			updateDto: UpdateCardsPageDto,
		});

		this.pageCreateBuilderRegistryService.register(this.cardsPageNestedBuilderService);
	}
}
