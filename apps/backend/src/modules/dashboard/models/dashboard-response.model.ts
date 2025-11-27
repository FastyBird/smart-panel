import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { DataSourceEntity, PageEntity, TileEntity } from '../entities/dashboard.entity';

/**
 * Response wrapper for PageEntity
 */
@ApiSchema({ name: 'DashboardModuleResPage' })
export class PageResponseModel extends BaseSuccessResponseModel<PageEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => PageEntity,
	})
	@Expose()
	declare data: PageEntity;
}

/**
 * Response wrapper for array of PageEntity
 */
@ApiSchema({ name: 'DashboardModuleResPages' })
export class PagesResponseModel extends BaseSuccessResponseModel<PageEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(PageEntity) },
	})
	@Expose()
	declare data: PageEntity[];
}

/**
 * Response wrapper for TileEntity
 */
@ApiSchema({ name: 'DashboardModuleResTile' })
export class TileResponseModel extends BaseSuccessResponseModel<TileEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => TileEntity,
	})
	@Expose()
	declare data: TileEntity;
}

/**
 * Response wrapper for array of TileEntity
 */
@ApiSchema({ name: 'DashboardModuleResTiles' })
export class TilesResponseModel extends BaseSuccessResponseModel<TileEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(TileEntity) },
	})
	@Expose()
	declare data: TileEntity[];
}

/**
 * Response wrapper for DataSourceEntity
 */
@ApiSchema({ name: 'DashboardModuleResDataSource' })
export class DataSourceResponseModel extends BaseSuccessResponseModel<DataSourceEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DataSourceEntity,
	})
	@Expose()
	declare data: DataSourceEntity;
}

/**
 * Response wrapper for array of DataSourceEntity
 */
@ApiSchema({ name: 'DashboardModuleResDataSources' })
export class DataSourcesResponseModel extends BaseSuccessResponseModel<DataSourceEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(DataSourceEntity) },
	})
	@Expose()
	declare data: DataSourceEntity[];
}
