import { Type } from '@nestjs/common';

/**
 * OpenAPI extra models for the Spaces Home Control plugin.
 *
 * This list will grow as Phase 3a relocates domain entities, DTOs, and
 * response models out of `modules/spaces/` into the plugin. Models that
 * still live in core are registered by `SpacesModule` — keeping them
 * there preserves existing schema names in the generated client.
 */

export const SPACES_HOME_CONTROL_PLUGIN_SWAGGER_EXTRA_MODELS: (
	| Type<unknown>
	| (abstract new (...args: unknown[]) => unknown)
)[] = [];
