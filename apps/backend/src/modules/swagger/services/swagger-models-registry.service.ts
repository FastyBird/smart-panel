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
	 * Register one or more models to be included in OpenAPI generation
	 * @param models Array of model classes to register (including abstract classes)
	 */
	register(models: (Type<unknown> | (abstract new (...args: unknown[]) => unknown))[]): void {
		for (const model of models) {
			this.models.add(model);
		}
	}

	/**
	 * Get all registered models as an array
	 * @returns Array of all registered model classes
	 */
	getAll(): (Type<unknown> | (abstract new (...args: unknown[]) => unknown))[] {
		return Array.from(this.models);
	}
}
