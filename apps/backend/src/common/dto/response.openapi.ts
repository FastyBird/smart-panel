/**
 * OpenAPI transformations for common DTOs
 * This file registers common OpenAPI spec transformations
 */
import { openApiTransformRegistry } from '../decorators/openapi-transform.decorator';

// Register transformations when this module is loaded
openApiTransformRegistry.register((document) => {
	// Add missing schema aliases for OpenAPI spec compatibility
	if (document.components && typeof document.components === 'object') {
		const components = document.components as Record<string, unknown>;
		if (components.schemas && typeof components.schemas === 'object') {
			const schemas = components.schemas as Record<string, unknown>;

			// Add CommonResMetadata alias (same as SuccessMetadataDto)
			if (schemas.SuccessMetadataDto && !schemas.CommonResMetadata) {
				schemas.CommonResMetadata = JSON.parse(JSON.stringify(schemas.SuccessMetadataDto));
			}
		}
	}
});
