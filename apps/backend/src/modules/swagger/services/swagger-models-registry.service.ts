import { Injectable, Type } from '@nestjs/common';

/**
 * Registry service for collecting Swagger extra models dynamically
 *
 * Modules and plugins can register their OpenAPI models here at runtime,
 * which will be used in SwaggerModule.createDocument() instead of a static array.
 */
@Injectable()
export class SwaggerModelsRegistryService {
	private readonly models = new Set<Type<unknown> | (abstract new (...args: unknown[]) => unknown)>();

	/**
	 * Register a model to be included in OpenAPI generation
	 * @param model Model class to register (including abstract classes)
	 */
	register(model: Type<unknown> | (abstract new (...args: unknown[]) => unknown)): void {
		this.models.add(model);
	}

	/**
	 * Get all registered models as an array
	 * @returns Array of all registered model classes
	 */
	getAll(): (Type<unknown> | (abstract new (...args: unknown[]) => unknown))[] {
		return Array.from(this.models);
	}
}
