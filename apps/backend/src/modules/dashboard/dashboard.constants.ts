export const DASHBOARD_MODULE_PREFIX = 'dashboard-module';

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
