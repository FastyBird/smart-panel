import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { SpaceEntity } from '../entities/space.entity';

/**
 * Response wrapper for SpaceEntity
 */
@ApiSchema({ name: 'SpacesModuleResSpace' })
export class SpaceResponseModel extends BaseSuccessResponseModel<SpaceEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => SpaceEntity,
	})
	@Expose()
	declare data: SpaceEntity;
}

/**
 * Response wrapper for array of SpaceEntity
 */
@ApiSchema({ name: 'SpacesModuleResSpaces' })
export class SpacesResponseModel extends BaseSuccessResponseModel<SpaceEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(SpaceEntity) },
	})
	@Expose()
	declare data: SpaceEntity[];
}

/**
 * Bulk assignment request data
 */
@ApiSchema({ name: 'SpacesModuleDataBulkAssignment' })
export class BulkAssignmentDataModel {
	@ApiProperty({
		name: 'device_ids',
		description: 'Array of device IDs to assign to the space',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose({ name: 'device_ids' })
	deviceIds: string[];

	@ApiProperty({
		name: 'display_ids',
		description: 'Array of display IDs to assign to the space',
		type: 'array',
		items: { type: 'string', format: 'uuid' },
		example: ['f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6'],
	})
	@Expose({ name: 'display_ids' })
	displayIds: string[];
}

/**
 * Bulk assignment result data
 */
@ApiSchema({ name: 'SpacesModuleDataBulkAssignmentResult' })
export class BulkAssignmentResultDataModel {
	@ApiProperty({
		description: 'Whether the bulk assignment was successful',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;

	@ApiProperty({
		name: 'devices_assigned',
		description: 'Number of devices assigned',
		type: 'integer',
		example: 5,
	})
	@Expose({ name: 'devices_assigned' })
	devicesAssigned: number;

	@ApiProperty({
		name: 'displays_assigned',
		description: 'Number of displays assigned',
		type: 'integer',
		example: 1,
	})
	@Expose({ name: 'displays_assigned' })
	displaysAssigned: number;
}

/**
 * Response wrapper for bulk assignment result
 */
@ApiSchema({ name: 'SpacesModuleResBulkAssignment' })
export class BulkAssignmentResponseModel extends BaseSuccessResponseModel<BulkAssignmentResultDataModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => BulkAssignmentResultDataModel,
	})
	@Expose()
	@Type(() => BulkAssignmentResultDataModel)
	declare data: BulkAssignmentResultDataModel;
}
