import { validate as uuidValidate } from 'uuid';

import { Injectable } from '@nestjs/common';

import { DataSourceEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { IDataSourceRelationsLoader } from '../../../modules/dashboard/entities/dashboard.relations';
import { LocationsService } from '../../../modules/weather/services/locations.service';
import {
	CurrentWeatherDataSourceEntity,
	ForecastDayDataSourceEntity,
} from '../entities/data-sources-weather.entity';

@Injectable()
export class WeatherDataSourceRelationsLoaderService implements IDataSourceRelationsLoader {
	constructor(private readonly locationsService: LocationsService) {}

	async loadRelations(dataSource: CurrentWeatherDataSourceEntity | ForecastDayDataSourceEntity): Promise<void> {
		if (typeof dataSource.locationId === 'string' && uuidValidate(dataSource.locationId)) {
			dataSource.location = await this.locationsService.findOne(dataSource.locationId);
		}
	}

	supports(entity: DataSourceEntity): boolean {
		return entity instanceof CurrentWeatherDataSourceEntity || entity instanceof ForecastDayDataSourceEntity;
	}
}
