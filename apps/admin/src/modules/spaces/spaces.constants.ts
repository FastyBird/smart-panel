export const SPACES_MODULE_PREFIX = 'spaces';
export const SPACES_MODULE_NAME = 'spaces-module';
export const SPACES_MODULE_EVENT_PREFIX = 'SpacesModule.';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;

export enum EventType {
	SPACE_CREATED = 'SpacesModule.Space.Created',
	SPACE_UPDATED = 'SpacesModule.Space.Updated',
	SPACE_DELETED = 'SpacesModule.Space.Deleted',
}

export const RouteNames = {
	SPACES: 'spaces_module-spaces',
	SPACES_ADD: 'spaces_module-spaces_add',
	SPACES_EDIT: 'spaces_module-spaces_edit',
	SPACE: 'spaces_module-space',
	SPACE_EDIT: 'spaces_module-space_edit',
	SPACES_ONBOARDING: 'spaces_module-onboarding',
};

export enum SpaceType {
	ROOM = 'room',
	ZONE = 'zone',
}

/**
 * Room categories for SpaceType.ROOM
 * Represents physical rooms within a building
 */
export enum SpaceRoomCategory {
	LIVING_ROOM = 'living_room',
	BEDROOM = 'bedroom',
	BATHROOM = 'bathroom',
	TOILET = 'toilet',
	KITCHEN = 'kitchen',
	DINING_ROOM = 'dining_room',
	OFFICE = 'office',
	ENTRYWAY = 'entryway',
	GARAGE = 'garage',
	HALLWAY = 'hallway',
	LAUNDRY = 'laundry',
	UTILITY_ROOM = 'utility_room',
	STORAGE = 'storage',
	CLOSET = 'closet',
	PANTRY = 'pantry',
	NURSERY = 'nursery',
	GUEST_ROOM = 'guest_room',
	GYM = 'gym',
	MEDIA_ROOM = 'media_room',
	WORKSHOP = 'workshop',
	OTHER = 'other',
}

/**
 * Zone categories for SpaceType.ZONE
 * Represents logical groupings or areas that aggregate multiple rooms/spaces
 */
export enum SpaceZoneCategory {
	// Floor zones
	FLOOR_GROUND = 'floor_ground',
	FLOOR_FIRST = 'floor_first',
	FLOOR_SECOND = 'floor_second',
	FLOOR_BASEMENT = 'floor_basement',
	FLOOR_ATTIC = 'floor_attic',
	// Outdoor areas
	OUTDOOR_FRONT_YARD = 'outdoor_front_yard',
	OUTDOOR_BACKYARD = 'outdoor_backyard',
	OUTDOOR_DRIVEWAY = 'outdoor_driveway',
	OUTDOOR_GARDEN = 'outdoor_garden',
	OUTDOOR_TERRACE = 'outdoor_terrace',
	OUTDOOR_BALCONY = 'outdoor_balcony',
	OUTDOOR_WALKWAY = 'outdoor_walkway',
	// Security
	SECURITY_PERIMETER = 'security_perimeter',
	// Utility
	UTILITY = 'utility',
	// Other
	OTHER = 'zone_other',
}

/**
 * Combined SpaceCategory type for backward compatibility
 * @deprecated Use SpaceRoomCategory or SpaceZoneCategory based on SpaceType
 */
export type SpaceCategory = SpaceRoomCategory | SpaceZoneCategory;

/**
 * SpaceCategory enum for backward compatibility with existing code
 * @deprecated Use SpaceRoomCategory or SpaceZoneCategory based on SpaceType
 */
export const SpaceCategory = {
	...SpaceRoomCategory,
	...SpaceZoneCategory,
} as const;

/**
 * Array of all room category values
 */
export const SPACE_ROOM_CATEGORIES = Object.values(SpaceRoomCategory);

/**
 * Array of all zone category values
 */
export const SPACE_ZONE_CATEGORIES = Object.values(SpaceZoneCategory);

/**
 * Array of floor zone categories
 * Floor zones cannot be explicitly assigned to devices - floor membership is derived from room→zone hierarchy
 */
export const FLOOR_ZONE_CATEGORIES: SpaceZoneCategory[] = [
	SpaceZoneCategory.FLOOR_GROUND,
	SpaceZoneCategory.FLOOR_FIRST,
	SpaceZoneCategory.FLOOR_SECOND,
	SpaceZoneCategory.FLOOR_BASEMENT,
	SpaceZoneCategory.FLOOR_ATTIC,
];

/**
 * Check if a category is a floor zone category
 * @param category - The category to check
 * @returns true if the category is a floor zone
 */
export function isFloorZoneCategory(category: string | null): boolean {
	if (category === null) return false;
	return FLOOR_ZONE_CATEGORIES.includes(category as SpaceZoneCategory);
}

/**
 * Get non-floor zone categories (zones that can be explicitly assigned to devices)
 */
export const ASSIGNABLE_ZONE_CATEGORIES = SPACE_ZONE_CATEGORIES.filter(
	(cat) => !FLOOR_ZONE_CATEGORIES.includes(cat)
);

/**
 * Array of all category values (room + zone)
 */
export const ALL_SPACE_CATEGORIES = [...SPACE_ROOM_CATEGORIES, ...SPACE_ZONE_CATEGORIES];

/**
 * Get categories available for a given space type
 */
export function getCategoriesForType(type: SpaceType): string[] {
	if (type === SpaceType.ROOM) {
		return SPACE_ROOM_CATEGORIES;
	}
	if (type === SpaceType.ZONE) {
		return SPACE_ZONE_CATEGORIES;
	}
	return ALL_SPACE_CATEGORIES;
}

/**
 * Check if a category is valid for a given space type
 */
export function isValidCategoryForType(category: string | null, type: SpaceType): boolean {
	if (category === null) {
		return true;
	}
	if (type === SpaceType.ROOM) {
		return SPACE_ROOM_CATEGORIES.includes(category as SpaceRoomCategory);
	}
	if (type === SpaceType.ZONE) {
		return SPACE_ZONE_CATEGORIES.includes(category as SpaceZoneCategory);
	}
	return false;
}

/**
 * Category group definition for organizing categories in UI
 */
export interface CategoryGroup {
	key: string;
	categories: string[];
}

/**
 * Zone category groups for UI organization
 */
export const ZONE_CATEGORY_GROUPS: CategoryGroup[] = [
	{
		key: 'floors',
		categories: [
			SpaceZoneCategory.FLOOR_GROUND,
			SpaceZoneCategory.FLOOR_FIRST,
			SpaceZoneCategory.FLOOR_SECOND,
			SpaceZoneCategory.FLOOR_BASEMENT,
			SpaceZoneCategory.FLOOR_ATTIC,
		],
	},
	{
		key: 'outdoor',
		categories: [
			SpaceZoneCategory.OUTDOOR_FRONT_YARD,
			SpaceZoneCategory.OUTDOOR_BACKYARD,
			SpaceZoneCategory.OUTDOOR_DRIVEWAY,
			SpaceZoneCategory.OUTDOOR_GARDEN,
			SpaceZoneCategory.OUTDOOR_TERRACE,
			SpaceZoneCategory.OUTDOOR_BALCONY,
			SpaceZoneCategory.OUTDOOR_WALKWAY,
		],
	},
	{
		key: 'other',
		categories: [
			SpaceZoneCategory.SECURITY_PERIMETER,
			SpaceZoneCategory.UTILITY,
			SpaceZoneCategory.OTHER,
		],
	},
];

/**
 * Get grouped categories for a given space type
 * Room categories are returned as a single ungrouped list
 * Zone categories are returned grouped by floor/outdoor/other
 */
export function getGroupedCategoriesForType(type: SpaceType): CategoryGroup[] | null {
	if (type === SpaceType.ZONE) {
		return ZONE_CATEGORY_GROUPS;
	}
	// Room categories are not grouped
	return null;
}

/**
 * Template definition for a space category
 */
export interface SpaceCategoryTemplate {
	category: SpaceCategory;
	icon: string;
	description: string;
}

/**
 * Default templates for room categories
 */
export const SPACE_ROOM_CATEGORY_TEMPLATES: Record<SpaceRoomCategory, Omit<SpaceCategoryTemplate, 'category'>> = {
	[SpaceRoomCategory.LIVING_ROOM]: {
		icon: 'mdi:sofa',
		description: 'Main living and entertainment area',
	},
	[SpaceRoomCategory.BEDROOM]: {
		icon: 'mdi:bed',
		description: 'Sleeping and personal space',
	},
	[SpaceRoomCategory.BATHROOM]: {
		icon: 'mdi:shower',
		description: 'Bathroom and hygiene area',
	},
	[SpaceRoomCategory.TOILET]: {
		icon: 'mdi:toilet',
		description: 'Toilet or water closet',
	},
	[SpaceRoomCategory.KITCHEN]: {
		icon: 'mdi:stove',
		description: 'Food preparation and cooking area',
	},
	[SpaceRoomCategory.DINING_ROOM]: {
		icon: 'mdi:silverware-fork-knife',
		description: 'Dining and eating area',
	},
	[SpaceRoomCategory.OFFICE]: {
		icon: 'mdi:desk',
		description: 'Home office or work space',
	},
	[SpaceRoomCategory.ENTRYWAY]: {
		icon: 'mdi:door-open',
		description: 'Entry, foyer or vestibule',
	},
	[SpaceRoomCategory.GARAGE]: {
		icon: 'mdi:garage',
		description: 'Vehicle storage and workshop area',
	},
	[SpaceRoomCategory.HALLWAY]: {
		icon: 'mdi:door',
		description: 'Corridor and passage area',
	},
	[SpaceRoomCategory.LAUNDRY]: {
		icon: 'mdi:washing-machine',
		description: 'Laundry and utility area',
	},
	[SpaceRoomCategory.UTILITY_ROOM]: {
		icon: 'mdi:water-boiler',
		description: 'Utility room with mechanical systems',
	},
	[SpaceRoomCategory.STORAGE]: {
		icon: 'mdi:archive',
		description: 'Storage and closet space',
	},
	[SpaceRoomCategory.CLOSET]: {
		icon: 'mdi:hanger',
		description: 'Walk-in closet or wardrobe room',
	},
	[SpaceRoomCategory.PANTRY]: {
		icon: 'mdi:fridge-outline',
		description: 'Food and supplies pantry',
	},
	[SpaceRoomCategory.NURSERY]: {
		icon: 'mdi:baby-carriage',
		description: 'Baby or child room',
	},
	[SpaceRoomCategory.GUEST_ROOM]: {
		icon: 'mdi:account-multiple',
		description: 'Guest bedroom or accommodation',
	},
	[SpaceRoomCategory.GYM]: {
		icon: 'mdi:dumbbell',
		description: 'Home gym or exercise area',
	},
	[SpaceRoomCategory.MEDIA_ROOM]: {
		icon: 'mdi:television',
		description: 'Home theater or media room',
	},
	[SpaceRoomCategory.WORKSHOP]: {
		icon: 'mdi:hammer-wrench',
		description: 'DIY workshop or hobby area',
	},
	[SpaceRoomCategory.OTHER]: {
		icon: 'mdi:home',
		description: 'Other or custom room',
	},
};

/**
 * Default templates for zone categories
 */
export const SPACE_ZONE_CATEGORY_TEMPLATES: Record<SpaceZoneCategory, Omit<SpaceCategoryTemplate, 'category'>> = {
	// Floor zones
	[SpaceZoneCategory.FLOOR_GROUND]: {
		icon: 'mdi:home-floor-0',
		description: 'Ground floor level',
	},
	[SpaceZoneCategory.FLOOR_FIRST]: {
		icon: 'mdi:home-floor-1',
		description: 'First floor level',
	},
	[SpaceZoneCategory.FLOOR_SECOND]: {
		icon: 'mdi:home-floor-2',
		description: 'Second floor level',
	},
	[SpaceZoneCategory.FLOOR_BASEMENT]: {
		icon: 'mdi:home-floor-b',
		description: 'Basement level',
	},
	[SpaceZoneCategory.FLOOR_ATTIC]: {
		icon: 'mdi:home-roof',
		description: 'Attic level',
	},
	// Outdoor areas
	[SpaceZoneCategory.OUTDOOR_FRONT_YARD]: {
		icon: 'mdi:home-import-outline',
		description: 'Front yard area',
	},
	[SpaceZoneCategory.OUTDOOR_BACKYARD]: {
		icon: 'mdi:home-export-outline',
		description: 'Backyard area',
	},
	[SpaceZoneCategory.OUTDOOR_DRIVEWAY]: {
		icon: 'mdi:road-variant',
		description: 'Driveway and parking area',
	},
	[SpaceZoneCategory.OUTDOOR_GARDEN]: {
		icon: 'mdi:flower',
		description: 'Garden and landscaped area',
	},
	[SpaceZoneCategory.OUTDOOR_TERRACE]: {
		icon: 'mdi:balcony',
		description: 'Terrace or patio area',
	},
	[SpaceZoneCategory.OUTDOOR_BALCONY]: {
		icon: 'mdi:balcony',
		description: 'Balcony area',
	},
	[SpaceZoneCategory.OUTDOOR_WALKWAY]: {
		icon: 'mdi:walk',
		description: 'Outdoor walkway or path',
	},
	// Security
	[SpaceZoneCategory.SECURITY_PERIMETER]: {
		icon: 'mdi:shield-home',
		description: 'Security perimeter zone',
	},
	// Utility
	[SpaceZoneCategory.UTILITY]: {
		icon: 'mdi:tools',
		description: 'Utility and service zone',
	},
	// Other
	[SpaceZoneCategory.OTHER]: {
		icon: 'mdi:map-marker',
		description: 'Other or custom zone',
	},
};

/**
 * Combined templates for all space categories (room + zone)
 * For backward compatibility
 */
export const SPACE_CATEGORY_TEMPLATES: Record<string, Omit<SpaceCategoryTemplate, 'category'>> = {
	...SPACE_ROOM_CATEGORY_TEMPLATES,
	...SPACE_ZONE_CATEGORY_TEMPLATES,
};

/**
 * Get templates for a given space type
 */
export function getTemplatesForType(
	type: SpaceType
): Record<string, Omit<SpaceCategoryTemplate, 'category'>> {
	if (type === SpaceType.ROOM) {
		return SPACE_ROOM_CATEGORY_TEMPLATES;
	}
	if (type === SpaceType.ZONE) {
		return SPACE_ZONE_CATEGORY_TEMPLATES;
	}
	return SPACE_CATEGORY_TEMPLATES;
}

// Re-export role enums from OpenAPI-generated types (single source of truth)
export { SpacesModuleLightingRole as LightingRole, SpacesModuleClimateRole as ClimateRole } from '../../openapi.constants';

// Import for local use in helper arrays
import { SpacesModuleClimateRole } from '../../openapi.constants';

// Helper arrays for role categorization
export const CLIMATE_CONTROL_ROLES = [
	SpacesModuleClimateRole.primary,
	SpacesModuleClimateRole.auxiliary,
	SpacesModuleClimateRole.ventilation,
	SpacesModuleClimateRole.humidity_control,
] as const;

export const CLIMATE_SENSOR_ROLES = [
	SpacesModuleClimateRole.temperature_sensor,
	SpacesModuleClimateRole.humidity_sensor,
] as const;

export enum FormResult {
	NONE = 'none',
	WORKING = 'working',
	ERROR = 'error',
	OK = 'ok',
}

export type FormResultType = FormResult.NONE | FormResult.WORKING | FormResult.ERROR | FormResult.OK;
