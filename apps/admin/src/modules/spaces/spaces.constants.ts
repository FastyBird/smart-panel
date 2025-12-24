export const SPACES_MODULE_PREFIX = 'spaces';
export const SPACES_MODULE_NAME = 'spaces-module';
export const SPACES_MODULE_EVENT_PREFIX = 'SpacesModule.';

export enum EventType {
	SPACE_CREATED = 'SpacesModule.Space.Created',
	SPACE_UPDATED = 'SpacesModule.Space.Updated',
	SPACE_DELETED = 'SpacesModule.Space.Deleted',
}

export const RouteNames = {
	SPACES: 'spaces_module-spaces',
	SPACES_EDIT: 'spaces_module-spaces_edit',
	SPACE: 'spaces_module-space',
	SPACE_EDIT: 'spaces_module-space_edit',
};

export enum SpaceType {
	ROOM = 'room',
	ZONE = 'zone',
}
