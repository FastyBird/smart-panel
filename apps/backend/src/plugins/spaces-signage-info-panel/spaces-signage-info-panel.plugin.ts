import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DisplaysModule } from '../../modules/displays/displays.module';
import { SpaceHomePageResolverRegistryService } from '../../modules/displays/services/space-home-page-resolver-registry.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { CreateSpaceDto } from '../../modules/spaces/dto/create-space.dto';
import { UpdateSpaceDto } from '../../modules/spaces/dto/update-space.dto';
import { SpaceEntity } from '../../modules/spaces/entities/space.entity';
import { SpacesTypeMapperService } from '../../modules/spaces/services/spaces-type-mapper.service';
import { SpacesModule } from '../../modules/spaces/spaces.module';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';
import { FactoryResetRegistryService } from '../../modules/system/services/factory-reset-registry.service';

import { SignageAnnouncementsController } from './controllers/signage-announcements.controller';
import { CreateSignageInfoPanelSpaceDto } from './dto/create-signage-info-panel-space.dto';
import { SpacesSignageInfoPanelUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateSignageInfoPanelSpaceDto } from './dto/update-signage-info-panel-space.dto';
import { SignageAnnouncementEntity } from './entities/signage-announcement.entity';
import { SignageInfoPanelSpaceEntity } from './entities/signage-info-panel-space.entity';
import { SpacesSignageInfoPanelConfigModel } from './models/config.model';
import { SignageAnnouncementsService } from './services/signage-announcements.service';
import { SignageHomePageResolver } from './services/signage-home-page.resolver';
import { SignageInfoPanelResetService } from './services/signage-info-panel-reset.service';
import {
	SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_DESCRIPTION,
	SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_NAME,
	SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME,
	SPACES_SIGNAGE_INFO_PANEL_TYPE,
} from './spaces-signage-info-panel.constants';
import { SPACES_SIGNAGE_INFO_PANEL_PLUGIN_SWAGGER_EXTRA_MODELS } from './spaces-signage-info-panel.openapi';

/**
 * Spaces Signage Info Panel plugin.
 *
 * Contributes the `signage_info_panel` space type — a read-only, full-screen
 * surface driven by configurable sections (clock, weather, announcements,
 * optional external feed). The plugin owns a dedicated child entity on
 * `spaces_module_spaces` plus an `signage_info_panel_announcements` table
 * with nested CRUD + reorder endpoints.
 */
@ApiTag({
	tagName: SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME,
	displayName: SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_NAME,
	description: SPACES_SIGNAGE_INFO_PANEL_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([SignageInfoPanelSpaceEntity, SignageAnnouncementEntity]),
		SpacesModule,
		DisplaysModule,
		SwaggerModule,
	],
	providers: [SignageAnnouncementsService, SignageInfoPanelResetService, SignageHomePageResolver],
	controllers: [SignageAnnouncementsController],
	exports: [SignageAnnouncementsService],
})
export class SpacesSignageInfoPanelPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly spacesTypeMapper: SpacesTypeMapperService,
		private readonly resetService: SignageInfoPanelResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly spaceHomePageResolverRegistry: SpaceHomePageResolverRegistryService,
		private readonly signageHomePageResolver: SignageHomePageResolver,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit(): void {
		this.configMapper.registerMapping<SpacesSignageInfoPanelConfigModel, SpacesSignageInfoPanelUpdatePluginConfigDto>({
			type: SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME,
			class: SpacesSignageInfoPanelConfigModel,
			configDto: SpacesSignageInfoPanelUpdatePluginConfigDto,
		});

		this.spacesTypeMapper.registerMapping<
			SignageInfoPanelSpaceEntity,
			CreateSignageInfoPanelSpaceDto,
			UpdateSignageInfoPanelSpaceDto
		>({
			type: SPACES_SIGNAGE_INFO_PANEL_TYPE,
			class: SignageInfoPanelSpaceEntity,
			createDto: CreateSignageInfoPanelSpaceDto,
			updateDto: UpdateSignageInfoPanelSpaceDto,
		});

		for (const model of SPACES_SIGNAGE_INFO_PANEL_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: SpaceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: SPACES_SIGNAGE_INFO_PANEL_TYPE,
			modelClass: SignageInfoPanelSpaceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateSpaceDto,
			discriminatorProperty: 'type',
			discriminatorValue: SPACES_SIGNAGE_INFO_PANEL_TYPE,
			modelClass: CreateSignageInfoPanelSpaceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateSpaceDto,
			discriminatorProperty: 'type',
			discriminatorValue: SPACES_SIGNAGE_INFO_PANEL_TYPE,
			modelClass: UpdateSignageInfoPanelSpaceDto,
		});

		this.spaceHomePageResolverRegistry.register(SPACES_SIGNAGE_INFO_PANEL_TYPE, this.signageHomePageResolver);

		this.factoryResetRegistry.register(
			SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.resetService.reset();
			},
			// Run BEFORE core SpacesModule reset (priority 280) so plugin-owned rows
			// are deleted via the subtype repository with clear log output, instead
			// of being silently swept by the core clear-everything pass.
			270,
		);

		this.extensionsService.registerPluginMetadata({
			type: SPACES_SIGNAGE_INFO_PANEL_PLUGIN_NAME,
			name: 'Spaces Signage Info Panel',
			description:
				'Contributes the information-panel signage space type — a read-only, full-screen surface with configurable sections (clock, weather, announcements, optional feed) and nested announcement CRUD.',
			author: 'FastyBird',
			readme: `# Spaces Signage Info Panel Plugin

Contributes the **Information Panel** signage space type — a read-only,
full-screen surface for hallway / lobby info displays.

## Features

- **Configurable sections** — clock, weather, announcements, optional external feed.
- **Announcements** — nested CRUD with priority, sort order, and optional active-window scheduling.
- **Per-space weather location** — the weather section reuses the existing weather plugin pipeline.
- **No dashboard chrome** — the panel renders the info view directly, bypassing pages and navigation.

## Uninstall behavior

Uninstalling leaves signage space rows orphaned in the spaces table; displays
pointing at them will no longer resolve to a rendered view until the plugin
is reinstalled. Factory reset re-seeds via the reset handler.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
