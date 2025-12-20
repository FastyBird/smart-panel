import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreateTileDto } from '../dto/create-tile.dto';
import { UpdateTileDto } from '../dto/update-tile.dto';
import { TileEntity } from '../entities/dashboard.entity';

export interface TileTypeMapping<
	TTile extends TileEntity,
	TCreateDTO extends CreateTileDto,
	TUpdateDTO extends UpdateTileDto,
> {
	type: string; // e.g., 'device-preview', 'clock'
	class: new (...args: any[]) => TTile; // Constructor for the tile class
	createDto: new (...args: any[]) => TCreateDTO; // Constructor for the Create DTO
	updateDto: new (...args: any[]) => TUpdateDTO; // Constructor for the Update DTO
}

@Injectable()
export class TilesTypeMapperService {
	private readonly logger = createExtensionLogger(DASHBOARD_MODULE_NAME, 'TilesTypeMapperService');

	private readonly mappings = new Map<string, TileTypeMapping<any, any, any>>();

	registerMapping<TTile extends TileEntity, TCreateDTO extends CreateTileDto, TUpdateDTO extends UpdateTileDto>(
		mapping: TileTypeMapping<TTile, TCreateDTO, TUpdateDTO>,
	): void {
		this.mappings.set(mapping.type, mapping);

		this.logger.log(`[REGISTERED] Tile type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<TTile extends TileEntity, TCreateDTO extends CreateTileDto, TUpdateDTO extends UpdateTileDto>(
		type: string,
	): TileTypeMapping<TTile, TCreateDTO, TUpdateDTO> {
		this.logger.debug(`Attempting to find mapping for tile type: '${type}'`);

		const mapping = this.mappings.get(type);

		if (!mapping) {
			this.logger.error(
				`[LOOKUP FAILED] Tile mapping for '${type}' is not registered. Available types: ${Array.from(this.mappings.keys()).join(', ') || 'None'}`,
			);

			throw new DashboardException(`Unsupported tile type: ${type}`);
		}

		this.logger.debug(`[LOOKUP SUCCESS] Found mapping for tile type: '${type}'`);

		return mapping as TileTypeMapping<TTile, TCreateDTO, TUpdateDTO>;
	}
}
