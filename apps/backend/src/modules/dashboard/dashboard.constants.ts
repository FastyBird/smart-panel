export const DASHBOARD_MODULE_PREFIX = 'dashboard-module';

export const DASHBOARD_MODULE_NAME = 'dashboard-module';

export enum EventType {
	PAGE_CREATED = 'DashboardModule.Page.Created',
	PAGE_UPDATED = 'DashboardModule.Page.Updated',
	PAGE_DELETED = 'DashboardModule.Page.Deleted',
	PAGE_RESET = 'DashboardModule.Page.Reset',
	TILE_CREATED = 'DashboardModule.Tile.Created',
	TILE_UPDATED = 'DashboardModule.Tile.Updated',
	TILE_DELETED = 'DashboardModule.Tile.Deleted',
	TILE_RESET = 'DashboardModule.Tile.Reset',
	DATA_SOURCE_CREATED = 'DashboardModule.DataSource.Created',
	DATA_SOURCE_UPDATED = 'DashboardModule.DataSource.Updated',
	DATA_SOURCE_DELETED = 'DashboardModule.DataSource.Deleted',
	DATA_SOURCE_RESET = 'DashboardModule.DataSource.Reset',
	MODULE_RESET = 'DashboardModule.All.Reset',
}
