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
	SPACES_OVERVIEW: 'spaces_module-overview',
	SPACES: 'spaces_module-spaces',
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
 * Space categories representing common room/area types
 * Used to provide default icons and descriptions for spaces
 */
export enum SpaceCategory {
	LIVING_ROOM = 'living_room',
	BEDROOM = 'bedroom',
	BATHROOM = 'bathroom',
	KITCHEN = 'kitchen',
	DINING_ROOM = 'dining_room',
	OFFICE = 'office',
	GARAGE = 'garage',
	HALLWAY = 'hallway',
	LAUNDRY = 'laundry',
	STORAGE = 'storage',
	OUTDOOR = 'outdoor',
	BASEMENT = 'basement',
	ATTIC = 'attic',
	NURSERY = 'nursery',
	GUEST_ROOM = 'guest_room',
	GYM = 'gym',
	MEDIA_ROOM = 'media_room',
	WORKSHOP = 'workshop',
	OTHER = 'other',
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
 * Default templates for each space category
 * Provides suggested icons and descriptions that can be used when creating spaces
 */
export const SPACE_CATEGORY_TEMPLATES: Record<SpaceCategory, Omit<SpaceCategoryTemplate, 'category'>> = {
	[SpaceCategory.LIVING_ROOM]: {
		icon: 'mdi:sofa',
		description: 'Main living and entertainment area',
	},
	[SpaceCategory.BEDROOM]: {
		icon: 'mdi:bed',
		description: 'Sleeping and personal space',
	},
	[SpaceCategory.BATHROOM]: {
		icon: 'mdi:shower',
		description: 'Bathroom and hygiene area',
	},
	[SpaceCategory.KITCHEN]: {
		icon: 'mdi:stove',
		description: 'Food preparation and cooking area',
	},
	[SpaceCategory.DINING_ROOM]: {
		icon: 'mdi:silverware-fork-knife',
		description: 'Dining and eating area',
	},
	[SpaceCategory.OFFICE]: {
		icon: 'mdi:desk',
		description: 'Home office or work space',
	},
	[SpaceCategory.GARAGE]: {
		icon: 'mdi:garage',
		description: 'Vehicle storage and workshop area',
	},
	[SpaceCategory.HALLWAY]: {
		icon: 'mdi:door',
		description: 'Corridor and passage area',
	},
	[SpaceCategory.LAUNDRY]: {
		icon: 'mdi:washing-machine',
		description: 'Laundry and utility area',
	},
	[SpaceCategory.STORAGE]: {
		icon: 'mdi:archive',
		description: 'Storage and closet space',
	},
	[SpaceCategory.OUTDOOR]: {
		icon: 'mdi:flower',
		description: 'Outdoor garden, patio, or balcony',
	},
	[SpaceCategory.BASEMENT]: {
		icon: 'mdi:stairs-down',
		description: 'Basement or cellar area',
	},
	[SpaceCategory.ATTIC]: {
		icon: 'mdi:stairs-up',
		description: 'Attic or loft space',
	},
	[SpaceCategory.NURSERY]: {
		icon: 'mdi:baby-carriage',
		description: 'Baby or child room',
	},
	[SpaceCategory.GUEST_ROOM]: {
		icon: 'mdi:account-multiple',
		description: 'Guest bedroom or accommodation',
	},
	[SpaceCategory.GYM]: {
		icon: 'mdi:dumbbell',
		description: 'Home gym or exercise area',
	},
	[SpaceCategory.MEDIA_ROOM]: {
		icon: 'mdi:television',
		description: 'Home theater or media room',
	},
	[SpaceCategory.WORKSHOP]: {
		icon: 'mdi:hammer-wrench',
		description: 'DIY workshop or hobby area',
	},
	[SpaceCategory.OTHER]: {
		icon: 'mdi:home',
		description: 'Other or custom space',
	},
};

export enum LightingRole {
	MAIN = 'main',
	TASK = 'task',
	AMBIENT = 'ambient',
	ACCENT = 'accent',
	NIGHT = 'night',
	OTHER = 'other',
}
