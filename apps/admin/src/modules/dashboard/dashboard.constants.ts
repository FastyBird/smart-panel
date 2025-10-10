export const DASHBOARD_MODULE_PREFIX = 'dashboard-module';

export const DASHBOARD_MODULE_NAME = 'dashboard-module';

export const DASHBOARD_MODULE_EVENT_PREFIX = 'DashboardModule.';

export enum EventType {
	PAGE_CREATED = 'DashboardModule.Page.Created',
	PAGE_UPDATED = 'DashboardModule.Page.Updated',
	PAGE_DELETED = 'DashboardModule.Page.Deleted',
	TILE_CREATED = 'DashboardModule.Tile.Created',
	TILE_UPDATED = 'DashboardModule.Tile.Updated',
	TILE_DELETED = 'DashboardModule.Tile.Deleted',
	DATA_SOURCE_CREATED = 'DashboardModule.DataSource.Created',
	DATA_SOURCE_UPDATED = 'DashboardModule.DataSource.Updated',
	DATA_SOURCE_DELETED = 'DashboardModule.DataSource.Deleted',
}

export enum FormResult {
	NONE = 'none',
	WORKING = 'working',
	ERROR = 'error',
	OK = 'ok',
}

export type FormResultType = FormResult.NONE | FormResult.WORKING | FormResult.ERROR | FormResult.OK;

export const RouteNames = {
	PAGES: 'dashboard_module-pages',
	PAGES_ADD: 'dashboard_module-pages_add',
	PAGES_EDIT: 'dashboard_module-pages_edit',
	PAGE: 'dashboard_module-page',
	PAGE_EDIT: 'dashboard_module-page_edit',
	PAGE_ADD_DATA_SOURCE: 'dashboard_module-page_add_data_source',
	PAGE_EDIT_DATA_SOURCE: 'dashboard_module-page_edit_data_source',
	PAGE_PLUGIN: 'dashboard_module-page_plugin',
	TILE: 'dashboard_module-tile',
	TILE_EDIT: 'dashboard_module-tile_edit',
	TILE_ADD_DATA_SOURCE: 'dashboard_module-tile_add_data_source',
	TILE_EDIT_DATA_SOURCE: 'dashboard_module-tile_edit_data_source',
};

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
