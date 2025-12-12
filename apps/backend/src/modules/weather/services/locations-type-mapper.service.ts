import { Injectable, Logger } from '@nestjs/common';

import { CreateLocationDto } from '../dto/create-location.dto';
import { UpdateLocationDto } from '../dto/update-location.dto';
import { WeatherLocationEntity } from '../entities/locations.entity';
import { WeatherException } from '../weather.exceptions';

export interface LocationTypeMapping<
	TLocation extends WeatherLocationEntity,
	TCreateDTO extends CreateLocationDto,
	TUpdateDTO extends UpdateLocationDto,
> {
	type: string;
	class: new (...args: any[]) => TLocation;
	createDto: new (...args: any[]) => TCreateDTO;
	updateDto: new (...args: any[]) => TUpdateDTO;
	afterCreate?: (location: TLocation) => Promise<TLocation>;
	afterUpdate?: (location: TLocation) => Promise<TLocation>;
}

@Injectable()
export class LocationsTypeMapperService {
	private readonly logger = new Logger(LocationsTypeMapperService.name);

	private readonly mappings = new Map<string, LocationTypeMapping<any, any, any>>();

	registerMapping<
		TLocation extends WeatherLocationEntity,
		TCreateDTO extends CreateLocationDto,
		TUpdateDTO extends UpdateLocationDto,
	>(mapping: LocationTypeMapping<TLocation, TCreateDTO, TUpdateDTO>): void {
		this.mappings.set(mapping.type, mapping);

		this.logger.log(`[REGISTERED] Location type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<
		TLocation extends WeatherLocationEntity,
		TCreateDTO extends CreateLocationDto,
		TUpdateDTO extends UpdateLocationDto,
	>(type: string): LocationTypeMapping<TLocation, TCreateDTO, TUpdateDTO> {
		this.logger.debug(`[LOOKUP] Attempting to find mapping for location type: '${type}'`);

		const mapping = this.mappings.get(type);

		if (!mapping) {
			this.logger.error(
				`[LOOKUP FAILED] Location mapping for '${type}' is not registered. Available types: ${Array.from(this.mappings.keys()).join(', ') || 'None'}`,
			);

			throw new WeatherException(`Unsupported location type: ${type}`);
		}

		this.logger.debug(`[LOOKUP SUCCESS] Found mapping for location type: '${type}'`);

		return mapping as LocationTypeMapping<TLocation, TCreateDTO, TUpdateDTO>;
	}

	listTypes(): string[] {
		return Array.from(this.mappings.keys());
	}
}
