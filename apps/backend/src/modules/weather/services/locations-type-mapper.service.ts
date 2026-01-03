import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { CreateLocationDto } from '../dto/create-location.dto';
import { UpdateLocationDto } from '../dto/update-location.dto';
import { WeatherLocationEntity } from '../entities/locations.entity';
import { WEATHER_MODULE_NAME } from '../weather.constants';
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
	private readonly logger = createExtensionLogger(WEATHER_MODULE_NAME, 'LocationsTypeMapperService');

	private readonly mappings = new Map<string, LocationTypeMapping<any, any, any>>();

	registerMapping<
		TLocation extends WeatherLocationEntity,
		TCreateDTO extends CreateLocationDto,
		TUpdateDTO extends UpdateLocationDto,
	>(mapping: LocationTypeMapping<TLocation, TCreateDTO, TUpdateDTO>): void {
		this.mappings.set(mapping.type, mapping);

		this.logger.log(`Location type '${mapping.type}' added. Total mappings: ${this.mappings.size}`);
	}

	getMapping<
		TLocation extends WeatherLocationEntity,
		TCreateDTO extends CreateLocationDto,
		TUpdateDTO extends UpdateLocationDto,
	>(type: string): LocationTypeMapping<TLocation, TCreateDTO, TUpdateDTO> {
		const mapping = this.mappings.get(type);

		if (!mapping) {
			this.logger.error(
				`Location mapping for '${type}' is not registered. Available types: ${Array.from(this.mappings.keys()).join(', ') || 'None'}`,
			);

			throw new WeatherException(`Unsupported location type: ${type}`);
		}

		return mapping as LocationTypeMapping<TLocation, TCreateDTO, TUpdateDTO>;
	}

	listTypes(): string[] {
		return Array.from(this.mappings.keys());
	}
}
