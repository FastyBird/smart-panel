/**
 * OpenAPI tag metadata
 */
export interface ApiTagMetadata {
	/**
	 * The tag name as used in @ApiTags decorator (kebab-case, e.g., 'auth-module')
	 */
	tagName: string;
	/**
	 * The display name for the tag (title case, e.g., 'Auth module')
	 */
	displayName: string;
	/**
	 * The description of the tag
	 */
	description: string;
}

/**
 * Global registry for OpenAPI tag metadata
 * Populated by @ApiTag decorators at class definition time
 */
class OpenApiTagRegistry {
	private readonly tags = new Map<string, ApiTagMetadata>();

	/**
	 * Register tag metadata
	 */
	register(metadata: ApiTagMetadata): void {
		if (this.tags.has(metadata.tagName)) {
			console.warn(`[OpenAPI] Tag '${metadata.tagName}' is already registered. Overwriting with new metadata.`);
		}
		this.tags.set(metadata.tagName, metadata);
	}

	/**
	 * Get tag metadata by tag name
	 */
	getTagMetadata(tagName: string): ApiTagMetadata | undefined {
		return this.tags.get(tagName);
	}

	/**
	 * Get all registered tag metadata
	 */
	getAllTags(): ApiTagMetadata[] {
		return Array.from(this.tags.values());
	}

	/**
	 * Get mapping from tag name (kebab-case) to display name (title case)
	 */
	getTagNameMapping(): Record<string, string> {
		const mapping: Record<string, string> = {};
		for (const [tagName, metadata] of this.tags.entries()) {
			mapping[tagName] = metadata.displayName;
		}
		return mapping;
	}

	/**
	 * Get tag definitions for OpenAPI spec (name and description)
	 */
	getTagDefinitions(): Array<{ name: string; description: string }> {
		return this.getAllTags().map((metadata) => ({
			name: metadata.displayName,
			description: metadata.description,
		}));
	}
}

// Singleton instance
export const openApiTagRegistry = new OpenApiTagRegistry();

/**
 * Custom decorator that registers OpenAPI tag metadata and applies @ApiTags
 *
 * @example
 * ```typescript
 * @ApiTag({
 *   tagName: 'auth-module',
 *   displayName: 'Auth module',
 *   description: 'Endpoints related to user authentication...'
 * })
 * @Controller('auth')
 * export class AuthController {}
 * ```
 */
export const ApiTag = (metadata: ApiTagMetadata) => {
	// Register the tag metadata in the global registry
	openApiTagRegistry.register(metadata);
};
