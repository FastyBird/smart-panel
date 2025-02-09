export const DashboardModulePrefix = 'dashboard-module';

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
	TILE_DATA_SOURCE_CREATED = 'DashboardModule.TileDataSource.Created',
	TILE_DATA_SOURCE_UPDATED = 'DashboardModule.TileDataSource.Updated',
	TILE_DATA_SOURCE_DELETED = 'DashboardModule.TileDataSource.Deleted',
}
