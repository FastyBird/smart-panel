export const DASHBOARD_MODULE_PREFIX = 'dashboard-module';

export const DASHBOARD_MODULE_NAME = 'dashboard-module';

export enum EventType {
	PAGE_CREATED = 'DashboardModule.Page.Created',
	PAGE_UPDATED = 'DashboardModule.Page.Updated',
	PAGE_DELETED = 'DashboardModule.Page.Deleted',
	CARD_CREATED = 'DashboardModule.Card.Created',
	CARD_UPDATED = 'DashboardModule.Card.Updated',
	CARD_DELETED = 'DashboardModule.Card.Deleted',
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
	PAGE_ADD_CARD: 'dashboard_module-page_add_card',
	PAGE_EDIT_CARD: 'dashboard_module-page_edit_card',
	PAGE_CARD_ADD_TILE: 'dashboard_module-page_card_add_tile',
	PAGE_CARD_EDIT_TILE: 'dashboard_module-page_card_edit_tile',
	PAGE_CARD_ADD_TILE_DATA_SOURCE: 'dashboard_module-page_card_add_tile_data_source',
	PAGE_CARD_EDIT_TILE_DATA_SOURCE: 'dashboard_module-page_card_edit_tile_data_source',
	PAGE_CARD_ADD_DATA_SOURCE: 'dashboard_module-page_card_add_data_source',
	PAGE_CARD_EDIT_DATA_SOURCE: 'dashboard_module-page_card_edit_data_source',
	PAGE_ADD_TILE: 'dashboard_module-page_add_tile',
	PAGE_EDIT_TILE: 'dashboard_module-page_edit_tile',
	PAGE_TILE_ADD_DATA_SOURCE: 'dashboard_module-page_tile_add_data_source',
	PAGE_TILE_EDIT_DATA_SOURCE: 'dashboard_module-page_tile_edit_data_source',
	PAGE_ADD_DATA_SOURCE: 'dashboard_module-page_add_data_source',
	PAGE_EDIT_DATA_SOURCE: 'dashboard_module-page_edit_data_source',
};
