/**
 * OpenAPI extra models for Dashboard module
 */
import { Type } from '@nestjs/common';

import { DataSourceEntity, PageEntity, TileEntity } from './entities/dashboard.entity';
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

export const DASHBOARD_SWAGGER_EXTRA_MODELS: Type<any>[] = [
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
