/**
 * Registry for OpenAPI document transformations
 * Allows modules/plugins to register post-processing hooks for the generated OpenAPI spec
 */

export type OpenApiTransformFunction = (document: Record<string, unknown>) => void;

/**
 * Global registry for OpenAPI transformations
 */
class OpenApiTransformRegistry {
	private readonly transforms: OpenApiTransformFunction[] = [];

	/**
	 * Register a transformation function
	 */
	register(transform: OpenApiTransformFunction): void {
		this.transforms.push(transform);
	}

	/**
	 * Apply all registered transformations to the document
	 */
	apply(document: Record<string, unknown>): void {
		for (const transform of this.transforms) {
			transform(document);
		}
	}

	/**
	 * Get all registered transforms
	 */
	getAllTransforms(): OpenApiTransformFunction[] {
		return [...this.transforms];
	}
}

// Singleton instance
export const openApiTransformRegistry = new OpenApiTransformRegistry();
