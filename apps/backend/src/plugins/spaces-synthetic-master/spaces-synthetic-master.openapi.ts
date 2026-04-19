import { Type } from '@nestjs/common';

import { CreateMasterSpaceDto } from './dto/create-master-space.dto';
import { UpdateMasterSpaceDto } from './dto/update-master-space.dto';
import { MasterSpaceEntity } from './entities/master-space.entity';

/**
 * OpenAPI extra models for the Spaces Synthetic Master plugin.
 *
 * Registering these with `SwaggerModelsRegistryService` produces dedicated
 * `SpacesSyntheticMasterPluginData*` / `...Create*` / `...Update*` schemas
 * alongside the core `SpacesModuleData*` family in the generated client.
 */
export const SPACES_SYNTHETIC_MASTER_PLUGIN_SWAGGER_EXTRA_MODELS: (
	| Type<unknown>
	| (abstract new (...args: unknown[]) => unknown)
)[] = [MasterSpaceEntity, CreateMasterSpaceDto, UpdateMasterSpaceDto];
