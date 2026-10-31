import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { SpaceOccupancyEntity } from '../entities/space-occupancy.entity';
import { OccupancyStatus } from '../occupancy/space-occupancy.types';

@ApiSchema({ name: 'SpacesHomeControlPluginDataOccupancyState' })
export class SpaceOccupancyStateModel {
	@ApiProperty({ name: 'space_id', type: 'string', format: 'uuid' })
	@Expose({ name: 'space_id' })
	spaceId: string;
	@ApiProperty({ enum: OccupancyStatus, description: 'Qualified observed presence; unknown never establishes vacancy' })
	@Expose()
	status: OccupancyStatus;
	@ApiProperty({ type: 'boolean' })
	@Expose()
	enabled: boolean;
	@ApiProperty({ type: 'boolean' })
	@Expose()
	running: boolean;
	@ApiProperty({ name: 'manual_override', type: 'boolean' })
	@Expose({ name: 'manual_override' })
	manualOverride: boolean;
	@ApiProperty({ name: 'vacancy_remaining_seconds', type: 'integer', nullable: true })
	@Expose({ name: 'vacancy_remaining_seconds' })
	vacancyRemainingSeconds: number | null;
	@ApiProperty({
		name: 'last_attempt_status',
		type: 'string',
		nullable: true,
		description: 'Software admission/result only; not physical convergence',
	})
	@Expose({ name: 'last_attempt_status' })
	lastAttemptStatus: string | null;
}

@ApiSchema({ name: 'SpacesHomeControlPluginDataOccupancySensor' })
export class SpaceOccupancySensorModel {
	@ApiProperty({ name: 'property_id', type: 'string', format: 'uuid' })
	@Expose({ name: 'property_id' })
	propertyId: string;
	@ApiProperty({ name: 'device_id', type: 'string', format: 'uuid' })
	@Expose({ name: 'device_id' })
	deviceId: string;
	@ApiProperty({ type: 'string' })
	@Expose()
	label: string;
}

@ApiSchema({ name: 'SpacesHomeControlPluginResOccupancyConfiguration' })
export class SpaceOccupancyResponseModel extends BaseSuccessResponseModel<SpaceOccupancyEntity> {
	@ApiProperty({ type: () => SpaceOccupancyEntity })
	@Expose()
	@Type(() => SpaceOccupancyEntity)
	declare data: SpaceOccupancyEntity;
}
@ApiSchema({ name: 'SpacesHomeControlPluginResOccupancyState' })
export class SpaceOccupancyStateResponseModel extends BaseSuccessResponseModel<SpaceOccupancyStateModel> {
	@ApiProperty({ type: () => SpaceOccupancyStateModel })
	@Expose()
	@Type(() => SpaceOccupancyStateModel)
	declare data: SpaceOccupancyStateModel;
}
@ApiSchema({ name: 'SpacesHomeControlPluginResOccupancySensors' })
export class SpaceOccupancySensorsResponseModel extends BaseSuccessResponseModel<SpaceOccupancySensorModel[]> {
	@ApiProperty({ type: () => SpaceOccupancySensorModel, isArray: true })
	@Expose()
	@Type(() => SpaceOccupancySensorModel)
	declare data: SpaceOccupancySensorModel[];
}
