import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { WeatherLocationEntity } from '../entities/locations.entity';

/**
 * Response wrapper for WeatherLocationEntity
 */
@ApiSchema({ name: 'WeatherModuleResLocation' })
export class LocationResponseModel extends BaseSuccessResponseModel<WeatherLocationEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => WeatherLocationEntity,
	})
	@Expose()
	declare data: WeatherLocationEntity;
}

/**
 * Response wrapper for array of WeatherLocationEntity
 */
@ApiSchema({ name: 'WeatherModuleResLocations' })
export class LocationsResponseModel extends BaseSuccessResponseModel<WeatherLocationEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(WeatherLocationEntity) },
	})
	@Expose()
	declare data: WeatherLocationEntity[];
}
