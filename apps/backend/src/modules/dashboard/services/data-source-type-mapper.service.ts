import { Injectable, Logger } from '@nestjs/common';

import { DashboardException } from '../dashboard.exceptions';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { UpdateDataSourceDto } from '../dto/update-data-source.dto';
import { DataSourceEntity } from '../entities/dashboard.entity';

export interface DataSourceTypeMapping<
	TDataSource extends DataSourceEntity,
	TCreateDTO extends CreateDataSourceDto,
	TUpdateDTO extends UpdateDataSourceDto,
> {
	type: string; // e.g., 'device-channel', 'time'
	class: new (...args: any[]) => TDataSource; // Constructor for the dataSource class
	createDto: new (...args: any[]) => TCreateDTO; // Constructor for the Create DTO
	updateDto: new (...args: any[]) => TUpdateDTO; // Constructor for the Update DTO
}

@Injectable()
export class DataSourcesTypeMapperService {
	private readonly logger = new Logger(DataSourcesTypeMapperService.name);

	private readonly mappings = new Map<string, DataSourceTypeMapping<any, any, any>>();

	registerMapping<
		TDataSource extends DataSourceEntity,
		TCreateDTO extends CreateDataSourceDto,
		TUpdateDTO extends UpdateDataSourceDto,
	>(mapping: DataSourceTypeMapping<TDataSource, TCreateDTO, TUpdateDTO>): void {
		this.mappings.set(mapping.type, mapping);

		this.logger.log(`[REGISTERED] Data source type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<
		TDataSource extends DataSourceEntity,
		TCreateDTO extends CreateDataSourceDto,
		TUpdateDTO extends UpdateDataSourceDto,
	>(type: string): DataSourceTypeMapping<TDataSource, TCreateDTO, TUpdateDTO> {
		this.logger.debug(`[LOOKUP] Attempting to find mapping for data source type: '${type}'`);

		const mapping = this.mappings.get(type);

		if (!mapping) {
			this.logger.error(
				`[LOOKUP FAILED] Data source mapping for '${type}' is not registered. Available types: ${Array.from(this.mappings.keys()).join(', ') || 'None'}`,
			);

			throw new DashboardException(`Unsupported data source type: ${type}`);
		}

		this.logger.debug(`[LOOKUP SUCCESS] Found mapping for data source type: '${type}'`);

		return mapping as DataSourceTypeMapping<TDataSource, TCreateDTO, TUpdateDTO>;
	}
}
