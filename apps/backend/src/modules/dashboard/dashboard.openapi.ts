/**
 * OpenAPI extra models for Dashboard module
 */
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { CreateTileDto } from './dto/create-tile.dto';
import {
	DataSourceResponseModel,
	DataSourcesResponseModel,
	PageResponseModel,
	PagesResponseModel,
	TileResponseModel,
	TilesResponseModel,
} from './models/dashboard-response.model';
import {
	ModuleStatsModel,
	RegisteredDataSourcesModel,
	RegisteredPagesModel,
	RegisteredTilesModel,
} from './models/dashboard.model';

export const DASHBOARD_SWAGGER_EXTRA_MODELS = [
	// DTOs (abstract classes need type assertion)
	CreateDataSourceDto,
	CreateTileDto,
	// Response models
	PageResponseModel,
	PagesResponseModel,
	TileResponseModel,
	TilesResponseModel,
	DataSourceResponseModel,
	DataSourcesResponseModel,
	// Data models
	RegisteredPagesModel,
	RegisteredTilesModel,
	RegisteredDataSourcesModel,
	ModuleStatsModel,
	// Entities (abstract classes are not included - only concrete implementations from plugins)
];
