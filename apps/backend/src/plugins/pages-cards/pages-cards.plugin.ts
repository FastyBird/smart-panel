import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { PageCreateBuilderRegistryService } from '../../modules/dashboard/services/page-create-builder-registry.service';
import { PagesTypeMapperService } from '../../modules/dashboard/services/pages-type-mapper.service';
import { FactoryResetRegistryService } from '../../modules/system/services/factory-reset-registry.service';
import { SystemModule } from '../../modules/system/system.module';

import { CardsController } from './controllers/cards.controller';
import { CreateCardsPageDto } from './dto/create-page.dto';
import { UpdateCardsPageDto } from './dto/update-page.dto';
import { CardEntity, CardsPageEntity } from './entities/pages-cards.entity';
import { PAGES_CARDS_PLUGIN_NAME, PAGES_CARDS_TYPE } from './pages-cards.constants';
import { CardsService } from './services/cards.service';
import { CardsPageNestedBuilderService } from './services/page-create-nested-builder.service';
import { PluginResetService } from './services/plugin-reset.service';

@Module({
	imports: [TypeOrmModule.forFeature([CardsPageEntity, CardEntity]), DashboardModule, SystemModule],
	providers: [CardsService, CardsPageNestedBuilderService, PluginResetService],
	controllers: [CardsController],
	exports: [CardsService],
})
export class PagesCardsPlugin {
	constructor(
		private readonly mapper: PagesTypeMapperService,
		private readonly pageCreateBuilderRegistryService: PageCreateBuilderRegistryService,
		private readonly cardsPageNestedBuilderService: CardsPageNestedBuilderService,
		private readonly pluginReset: PluginResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
	) {}

	onModuleInit() {
		this.mapper.registerMapping<CardsPageEntity, CreateCardsPageDto, UpdateCardsPageDto>({
			type: PAGES_CARDS_TYPE,
			class: CardsPageEntity,
			createDto: CreateCardsPageDto,
			updateDto: UpdateCardsPageDto,
		});

		this.pageCreateBuilderRegistryService.register(this.cardsPageNestedBuilderService);

		this.factoryResetRegistry.register(
			PAGES_CARDS_PLUGIN_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.pluginReset.reset();
			},
			90,
		);
	}
}
