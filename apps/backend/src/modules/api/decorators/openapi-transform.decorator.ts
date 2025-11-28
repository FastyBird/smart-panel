/**
 * Global registry for OpenAPI document transformations
 * Allows modules/plugins to register transformations that modify the OpenAPI spec
 */

type OpenApiTransformFn = (document: Record<string, unknown>) => void;

/**
 * Global registry for OpenAPI transformations
 * Populated by module/plugin openapi files at import time
 */
class OpenApiTransformRegistry {
	private readonly transformations: OpenApiTransformFn[] = [];

	/**
	 * Register a transformation function
	 */
	register(transform: OpenApiTransformFn): void {
		this.transformations.push(transform);
	}

	/**
	 * Apply all registered transformations to the OpenAPI document
	 */
	apply(document: Record<string, unknown>): void {
		for (const transform of this.transformations) {
			transform(document);
		}
	}
}

// Singleton instance
export const openApiTransformRegistry = new OpenApiTransformRegistry();
