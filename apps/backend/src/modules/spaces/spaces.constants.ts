export const SPACES_MODULE_NAME = 'spaces-module';
export const SPACES_MODULE_PREFIX = 'spaces';
export const SPACES_MODULE_API_TAG_NAME = 'Spaces module';
export const SPACES_MODULE_API_TAG_DESCRIPTION =
	'Endpoints for managing spaces (rooms/zones) in the Smart Panel system. ' +
	'Spaces allow organizing devices and displays into logical groups for a room-centric experience.';

/**
 * Base module events emitted for every space regardless of type. Domain-specific
 * events (lighting target, climate target, media activity, sensor target,
 * suggestions, etc.) live in the contributing plugin's constants module — see
 * `plugins/spaces-home-control/spaces-home-control.constants.ts`.
 */
export enum EventType {
	SPACE_CREATED = 'SpacesModule.Space.Created',
	SPACE_UPDATED = 'SpacesModule.Space.Updated',
	SPACE_DELETED = 'SpacesModule.Space.Deleted',
}

/**
 * Discriminator values for the polymorphic `spaces_module_spaces` table.
 * Core declares all known values (including those contributed by built-in
 * plugins such as spaces-synthetic-master / spaces-synthetic-entry) so the
 * generated OpenAPI schema keeps the enum shape. The plugin supplies the
 * concrete `@ChildEntity` class and service layer; when a plugin is not
 * installed, attempting to create a space of its type throws from
 * `SpacesTypeMapperService` (no registered mapping).
 */
export enum SpaceType {
	ROOM = 'room',
	ZONE = 'zone',
	MASTER = 'master',
	ENTRY = 'entry',
	SIGNAGE_INFO_PANEL = 'signage_info_panel',
}

/**
 * Discriminator values for the unified `spaces_module_space_roles` inheritance table.
 * Each subtype persists its domain-specific columns on the same table; see
 * `SpaceRoleEntity` + the `@ChildEntity` subclasses.
 */
export enum SpaceRoleType {
	LIGHTING = 'lighting',
	CLIMATE = 'climate',
	COVERS = 'covers',
	SENSOR = 'sensor',
	MEDIA_BINDING = 'media_binding',
	ACTIVE_MEDIA = 'active_media',
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
	GARAGE = 'garage',
	HALLWAY = 'hallway',
	ENTRYWAY = 'entryway',
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
 * Array of all room category values for validation
 */
export const SPACE_ROOM_CATEGORIES = Object.values(SpaceRoomCategory);

/**
 * Array of all zone category values for validation
 */
export const SPACE_ZONE_CATEGORIES = Object.values(SpaceZoneCategory);

/**
 * Floor zone categories - zones that represent building floors
 * Devices cannot be explicitly assigned to floor zones (membership is derived from room hierarchy)
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
 * Floor zones cannot have devices explicitly assigned (membership is derived from room→zone hierarchy)
 */
export function isFloorZoneCategory(category: string | null): boolean {
	if (category === null) {
		return false;
	}
	return FLOOR_ZONE_CATEGORIES.includes(category as SpaceZoneCategory);
}

/**
 * Array of all category values (room + zone) for validation
 */
export const ALL_SPACE_CATEGORIES = [...SPACE_ROOM_CATEGORIES, ...SPACE_ZONE_CATEGORIES];

/**
 * Check if a category is valid for a given space type
 */
export function isValidCategoryForType(category: string | null, type: SpaceType): boolean {
	if (category === null) {
		return true; // null is always valid
	}

	if (type === SpaceType.ROOM) {
		return SPACE_ROOM_CATEGORIES.includes(category as SpaceRoomCategory);
	}

	if (type === SpaceType.ZONE) {
		return SPACE_ZONE_CATEGORIES.includes(category as SpaceZoneCategory);
	}

	// Synthetic singleton space types (master, entry) and any future plugin-
	// contributed type do not accept a category. Returning false here rejects
	// a non-null category on anything that isn't ROOM or ZONE.
	return false;
}

/**
 * Template definition for a space category
 */
export interface SpaceCategoryTemplate {
	category: SpaceRoomCategory | SpaceZoneCategory;
	icon: string;
	description: string;
}

/**
 * Suggestion feedback types for tracking user interaction.
 *
 * Kept in core (rather than moved to spaces-home-control) because the buddy-*
 * plugins (`buddy-discord`, `buddy-telegram`, etc.) import this enum directly
 * and must not be coupled to an optional home-control plugin. It's a tiny
 * shared vocabulary — the minor taxonomic bleed is worth the decoupling.
 */
export enum SuggestionFeedback {
	APPLIED = 'applied',
	DISMISSED = 'dismissed',
}
