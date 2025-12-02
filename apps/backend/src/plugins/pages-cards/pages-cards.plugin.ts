import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { CreatePageDto } from '../../modules/dashboard/dto/create-page.dto';
import { UpdatePageDto } from '../../modules/dashboard/dto/update-page.dto';
import { PageEntity } from '../../modules/dashboard/entities/dashboard.entity';
import { PageCreateBuilderRegistryService } from '../../modules/dashboard/services/page-create-builder-registry.service';
import { PagesTypeMapperService } from '../../modules/dashboard/services/pages-type-mapper.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';
import { FactoryResetRegistryService } from '../../modules/system/services/factory-reset-registry.service';
import { SystemModule } from '../../modules/system/system.module';

import { CardsController } from './controllers/cards.controller';
import { CreateCardsPageDto } from './dto/create-page.dto';
import { CardsUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateCardsPageDto } from './dto/update-page.dto';
import { CardEntity, CardsPageEntity } from './entities/pages-cards.entity';
import { CardsConfigModel } from './models/config.model';
import {
	PAGES_CARDS_PLUGIN_API_TAG_DESCRIPTION,
	PAGES_CARDS_PLUGIN_API_TAG_NAME,
	PAGES_CARDS_PLUGIN_NAME,
	PAGES_CARDS_TYPE,
} from './pages-cards.constants';
import { PAGES_CARDS_PLUGIN_SWAGGER_EXTRA_MODELS } from './pages-cards.openapi';
import { CardsService } from './services/cards.service';
import { CardsPageNestedBuilderService } from './services/page-create-nested-builder.service';
import { PluginResetService } from './services/plugin-reset.service';

@ApiTag({
	tagName: PAGES_CARDS_PLUGIN_NAME,
	displayName: PAGES_CARDS_PLUGIN_API_TAG_NAME,
	description: PAGES_CARDS_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([CardsPageEntity, CardEntity]),
		DashboardModule,
		ConfigModule,
		SystemModule,
		SwaggerModule,
	],
	providers: [CardsService, CardsPageNestedBuilderService, PluginResetService],
	controllers: [CardsController],
	exports: [CardsService],
})
export class PagesCardsPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly pagesMapper: PagesTypeMapperService,
		private readonly pageCreateBuilderRegistryService: PageCreateBuilderRegistryService,
		private readonly cardsPageNestedBuilderService: CardsPageNestedBuilderService,
		private readonly pluginReset: PluginResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<CardsConfigModel, CardsUpdatePluginConfigDto>({
			type: PAGES_CARDS_PLUGIN_NAME,
			class: CardsConfigModel,
			configDto: CardsUpdatePluginConfigDto,
		});

		this.pagesMapper.registerMapping<CardsPageEntity, CreateCardsPageDto, UpdateCardsPageDto>({
			type: PAGES_CARDS_TYPE,
			class: CardsPageEntity,
			createDto: CreateCardsPageDto,
			updateDto: UpdateCardsPageDto,
		});

		this.pageCreateBuilderRegistryService.register(this.cardsPageNestedBuilderService);

		this.factoryResetRegistry.register(
			PAGES_CARDS_TYPE,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.pluginReset.reset();
			},
			90,
		);

		for (const model of PAGES_CARDS_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: PageEntity,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_CARDS_TYPE,
			modelClass: CardsPageEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_CARDS_TYPE,
			modelClass: CreateCardsPageDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_CARDS_TYPE,
			modelClass: UpdateCardsPageDto,
		});
	}
}
