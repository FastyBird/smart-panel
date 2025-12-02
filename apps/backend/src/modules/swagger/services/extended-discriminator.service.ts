import { Injectable, Type } from '@nestjs/common';

/**
 * Registration data for extended discriminator mappings in OpenAPI schemas.
 *
 * This allows modules and plugins to register discriminator mappings that extend
 * parent schemas with polymorphic variants based on a discriminator property.
 */
export interface ExtendedDiscriminatorRegistration {
	/**
	 * Parent class (Entity/DTO) that serves as the base schema.
	 * The schema name will be resolved using getSchemaPath from @nestjs/swagger.
	 * Can be a concrete class or abstract class.
	 */
	parentClass: Type<unknown> | (abstract new (...args: unknown[]) => unknown);

	/**
	 * Name of the property used for discrimination (discriminator.propertyName).
	 * Typically 'type', but can be other values like 'location_type'.
	 */
	discriminatorProperty: string;

	/**
	 * Discriminator value in the data (e.g., 'pages-cards', 'pages-tiles', 'pages-device-detail').
	 */
	discriminatorValue: string;

	/**
	 * Model/DTO class decorated with @ApiSchema.
	 * Must be included in extraModels to have its own schema in components/schemas.
	 * The schema name will be resolved using getSchemaPath from @nestjs/swagger.
	 */
	modelClass: Type<unknown> | (abstract new (...args: unknown[]) => unknown);
}

/**
 * Registry service for collecting extended discriminator mappings dynamically.
 *
 * Modules and plugins can register discriminator mappings here at runtime,
 * which will be used to configure polymorphic schemas in the OpenAPI document.
 */
@Injectable()
export class ExtendedDiscriminatorService {
	private readonly registrations: ExtendedDiscriminatorRegistration[] = [];

	/**
	 * Register a discriminator mapping to be included in OpenAPI generation.
	 * @param reg Registration data for the discriminator mapping
	 */
	register(reg: ExtendedDiscriminatorRegistration): void {
		this.registrations.push(reg);
	}

	/**
	 * Get all registered discriminator mappings.
	 * @returns Array of all registered discriminator mappings
	 */
	getAll(): ExtendedDiscriminatorRegistration[] {
		return [...this.registrations];
	}
}
