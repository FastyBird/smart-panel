import { BaseEntity } from '../../../common/entities/base.entity';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { CreatePageDto } from '../dto/create-page.dto';
import { CreateTileDto } from '../dto/create-tile.dto';

import { DataSourceEntity, PageEntity, TileEntity } from './dashboard.entity';

export interface IRelationLoader {
	supports(entity: BaseEntity): boolean;

	loadRelations(entity: BaseEntity): Promise<void>;
}

export interface IPageRelationsLoader extends IRelationLoader {
	supports(entity: PageEntity): boolean;

	loadRelations(entity: PageEntity): Promise<void>;
}

export interface ITileRelationsLoader extends IRelationLoader {
	supports(entity: TileEntity): boolean;

	loadRelations(entity: TileEntity): Promise<void>;
}

export interface IDataSourceRelationsLoader extends IRelationLoader {
	supports(entity: DataSourceEntity): boolean;

	loadRelations(entity: DataSourceEntity): Promise<void>;
}

export interface IPageNestedCreateBuilder {
	supports(dto: CreatePageDto): boolean;

	build(dto: CreatePageDto, page: PageEntity): Promise<void>;
}

export interface ITileNestedCreateBuilder {
	supports(dto: CreateTileDto): boolean;

	build(dto: CreateTileDto, tile: TileEntity): Promise<void>;
}

export interface IDataSourceNestedCreateBuilder {
	supports(dto: CreateDataSourceDto): boolean;

	build(dto: CreateDataSourceDto, dataSource: DataSourceEntity): Promise<void>;
}
