import { Type } from '@nestjs/common';

import { CreateEntrySpaceDto } from './dto/create-entry-space.dto';
import { SpacesSyntheticEntryUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateEntrySpaceDto } from './dto/update-entry-space.dto';
import { EntrySpaceEntity } from './entities/entry-space.entity';
import { SpacesSyntheticEntryConfigModel } from './models/config.model';

/**
 * OpenAPI extra models for the Spaces Synthetic Entry plugin.
 *
 * Registering these with `SwaggerModelsRegistryService` produces dedicated
 * `SpacesSyntheticEntryPluginData*` / `...Create*` / `...Update*` schemas
 * alongside the core `SpacesModuleData*` family in the generated client.
 */
export const SPACES_SYNTHETIC_ENTRY_PLUGIN_SWAGGER_EXTRA_MODELS: (
	| Type<unknown>
	| (abstract new (...args: unknown[]) => unknown)
)[] = [
	EntrySpaceEntity,
	CreateEntrySpaceDto,
	UpdateEntrySpaceDto,
	SpacesSyntheticEntryConfigModel,
	SpacesSyntheticEntryUpdatePluginConfigDto,
];
