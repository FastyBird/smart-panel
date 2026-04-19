import { Type } from '@nestjs/common';

import { CreateAnnouncementDto, ReqCreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateSignageInfoPanelSpaceDto } from './dto/create-signage-info-panel-space.dto';
import {
	ReorderAnnouncementEntryDto,
	ReorderAnnouncementsDto,
	ReqReorderAnnouncementsDto,
} from './dto/reorder-announcements.dto';
import { ReqUpdateAnnouncementDto, UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { UpdateSignageInfoPanelSpaceDto } from './dto/update-signage-info-panel-space.dto';
import { SignageAnnouncementEntity } from './entities/signage-announcement.entity';
import { SignageInfoPanelSpaceEntity } from './entities/signage-info-panel-space.entity';
import {
	SignageAnnouncementResponseModel,
	SignageAnnouncementsResponseModel,
} from './models/signage-announcement-response.model';

/**
 * OpenAPI extra models for the Spaces Signage Info Panel plugin.
 *
 * Registering these with `SwaggerModelsRegistryService` produces dedicated
 * `SpacesSignageInfoPanelPluginData*` / `...Create*` / `...Update*` / `...Res*`
 * schemas alongside the core `SpacesModuleData*` family in the generated client.
 */
export const SPACES_SIGNAGE_INFO_PANEL_PLUGIN_SWAGGER_EXTRA_MODELS: (
	| Type<unknown>
	| (abstract new (...args: unknown[]) => unknown)
)[] = [
	SignageInfoPanelSpaceEntity,
	SignageAnnouncementEntity,
	CreateSignageInfoPanelSpaceDto,
	UpdateSignageInfoPanelSpaceDto,
	CreateAnnouncementDto,
	ReqCreateAnnouncementDto,
	UpdateAnnouncementDto,
	ReqUpdateAnnouncementDto,
	ReorderAnnouncementEntryDto,
	ReorderAnnouncementsDto,
	ReqReorderAnnouncementsDto,
	SignageAnnouncementResponseModel,
	SignageAnnouncementsResponseModel,
];
