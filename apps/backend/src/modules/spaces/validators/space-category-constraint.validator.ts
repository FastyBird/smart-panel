import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import {
	ALL_SPACE_CATEGORIES,
	LEGACY_OUTDOOR_CATEGORY,
	SPACE_ROOM_CATEGORIES,
	SPACE_ZONE_CATEGORIES,
	SpaceType,
} from '../spaces.constants';

/**
 * Interface for DTOs that have both type and category fields
 */
interface SpaceTypeCategory {
	type?: SpaceType;
	category?: string | null;
}

/**
 * Validator constraint that checks if the category is valid for the given space type.
 *
 * Rules:
 * - If category is null, it's always valid
 * - If type is provided as ROOM, category must be in SpaceRoomCategory
 * - If type is provided as ZONE, category must be in SpaceZoneCategory
 * - If type is not provided (update case), category must exist in either enum
 * - Legacy 'outdoor' value is accepted for ZONE type (for backward compatibility)
 *
 * Note: For updates where type is not provided, the service layer performs
 * additional validation against the existing space's type.
 */
@ValidatorConstraint({ name: 'SpaceCategoryValidation', async: false })
export class SpaceCategoryConstraintValidator implements ValidatorConstraintInterface {
	validate(category: string | null | undefined, args: ValidationArguments): boolean {
		// Null/undefined category is always valid
		if (category === null || category === undefined) {
			return true;
		}

		const object = args.object as SpaceTypeCategory;
		const type = object.type;

		// If type is not provided (update case), accept any valid category
		// The service layer will validate against the existing type
		if (type === undefined) {
			// Accept legacy 'outdoor' value
			if (category === LEGACY_OUTDOOR_CATEGORY) {
				return true;
			}
			return ALL_SPACE_CATEGORIES.includes(category as (typeof ALL_SPACE_CATEGORIES)[number]);
		}

		// Handle legacy 'outdoor' value for zones
		if (category === LEGACY_OUTDOOR_CATEGORY && type === SpaceType.ZONE) {
			return true;
		}

		// Validate category based on provided type
		if (type === SpaceType.ROOM) {
			return SPACE_ROOM_CATEGORIES.includes(category as (typeof SPACE_ROOM_CATEGORIES)[number]);
		}

		if (type === SpaceType.ZONE) {
			return SPACE_ZONE_CATEGORIES.includes(category as (typeof SPACE_ZONE_CATEGORIES)[number]);
		}

		// Unknown type - check if category exists at all
		return ALL_SPACE_CATEGORIES.includes(category as (typeof ALL_SPACE_CATEGORIES)[number]);
	}

	defaultMessage(args: ValidationArguments): string {
		const object = args.object as SpaceTypeCategory;
		const type = object.type;
		const category = args.value as string;

		if (type === SpaceType.ROOM) {
			return `[{"field":"category","reason":"Category '${category}' is not valid for room type. Valid room categories: ${SPACE_ROOM_CATEGORIES.join(', ')}"}]`;
		}

		if (type === SpaceType.ZONE) {
			return `[{"field":"category","reason":"Category '${category}' is not valid for zone type. Valid zone categories: ${SPACE_ZONE_CATEGORIES.join(', ')}"}]`;
		}

		return `[{"field":"category","reason":"Category '${category}' is not a valid space category."}]`;
	}
}

/**
 * Decorator that validates the category field based on the type field.
 *
 * Usage:
 * ```typescript
 * @IsValidSpaceCategory()
 * category?: SpaceCategory | null;
 * ```
 */
export function IsValidSpaceCategory(validationOptions?: ValidationOptions) {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'isValidSpaceCategory',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: SpaceCategoryConstraintValidator,
		});
	};
}
