/**
 * Utility to collect OpenAPI tag definitions from decorators
 * Tags are registered via @ApiTag decorators on controllers
 */
import { openApiTagRegistry } from '../decorators/api-tag.decorator';

export interface OpenApiTagDefinition {
	name: string;
	description: string;
}

/**
 * Collects all OpenAPI tag definitions from @ApiTag decorators
 */
export function getAllApiTags(): OpenApiTagDefinition[] {
	return openApiTagRegistry.getTagDefinitions();
}

/**
 * Creates a mapping from kebab-case tag names to title case tag names
 */
export function getTagNameMapping(): Record<string, string> {
	return openApiTagRegistry.getTagNameMapping();
}
