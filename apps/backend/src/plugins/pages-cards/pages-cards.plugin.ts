import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { CreatePageDto } from '../../modules/dashboard/dto/create-page.dto';
import { UpdatePageDto } from '../../modules/dashboard/dto/update-page.dto';
import { PageEntity } from '../../modules/dashboard/entities/dashboard.entity';
import { PageCreateBuilderRegistryService } from '../../modules/dashboard/services/page-create-builder-registry.service';
import { PagesTypeMapperService } from '../../modules/dashboard/services/pages-type-mapper.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';
import { FactoryResetRegistryService } from '../../modules/system/services/factory-reset-registry.service';

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
	imports: [TypeOrmModule.forFeature([CardsPageEntity, CardEntity]), DashboardModule, SwaggerModule],
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
		private readonly extensionsService: ExtensionsService,
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

		// Register extension metadata
		this.extensionsService.registerPluginMetadata({
			type: PAGES_CARDS_PLUGIN_NAME,
			name: 'Cards Page',
			description: 'Dashboard page type for displaying information cards',
			author: 'FastyBird',
			readme: `# Cards Page

> Plugin · by FastyBird · platform: dashboard pages

Dashboard page type that lays out scrollable information cards — useful for status summaries, navigation menus, quick actions and "everything that doesn't fit a grid". Picks up where the tile grid stops: lists of items where each item is a small standalone card.

## What you get

- A flexible page surface for items that aren't tile-sized but still want a rich, tappable presentation
- A common shape for navigation hubs (e.g. a "rooms" page that lists every space with its key state)
- Logical grouping so pages stay legible even with many cards
- Tap actions that integrate with the rest of the system: trigger scenes, run scripts, navigate to other pages, or drop a user into a detail view

## Features

- **Card layout** — vertical scrolling list of cards, each with an icon, title, optional secondary line and tap action
- **Rich content** — text, icons, badges and accent colours per card
- **Quick actions** — fire scenes, send device commands or navigate to other dashboard pages
- **Section grouping** — organise cards into logical sections with optional headings
- **Live data** — cards bound to data sources update in real time without re-rendering the whole page

Each page defines its own cards (title, content, icon, action) when created — there is no global plugin configuration.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
