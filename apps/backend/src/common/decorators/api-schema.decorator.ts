import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export const API_SCHEMA_NAME_METADATA = 'api:schema:name';

/**
 * Decorator to set a custom schema name for OpenAPI documentation
 * @param name The custom schema name to use in the OpenAPI spec
 */
export function ApiSchema(name: string): ClassDecorator {
	return (target: object) => {
		Reflect.defineMetadata(API_SCHEMA_NAME_METADATA, name, target);
	};
}

/**
 * Get the custom schema name from a class if it has been set
 * @param target The class to get the schema name from
 * @returns The custom schema name or undefined if not set
 */
export function getApiSchemaName(target: object): string | undefined {
	return Reflect.getMetadata(API_SCHEMA_NAME_METADATA, target);
}
