import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../common/dto/response.dto';
import { DisplayInstanceEntity, UserEntity } from '../entities/users.entity';

/**
 * Response wrapper for UserEntity
 */
@ApiSchema({ name: 'UsersModuleResUser' })
export class UserResponseModel extends BaseSuccessResponseModel<UserEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => UserEntity,
	})
	@Expose()
	@Type(() => UserEntity)
	data: UserEntity;
}

/**
 * Response wrapper for array of UserEntity
 */
@ApiSchema({ name: 'UsersModuleResUsers' })
export class UsersResponseModel extends BaseSuccessResponseModel<UserEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(UserEntity) },
	})
	@Expose()
	@Type(() => UserEntity)
	data: UserEntity[];
}

/**
 * Response wrapper for DisplayInstanceEntity
 */
@ApiSchema({ name: 'UsersModuleResDisplayInstance' })
export class DisplayInstanceResponseModel extends BaseSuccessResponseModel<DisplayInstanceEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DisplayInstanceEntity,
	})
	@Expose()
	@Type(() => DisplayInstanceEntity)
	data: DisplayInstanceEntity;
}

/**
 * Response wrapper for array of DisplayInstanceEntity
 */
@ApiSchema({ name: 'UsersModuleResDisplayInstances' })
export class DisplayInstancesResponseModel extends BaseSuccessResponseModel<DisplayInstanceEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(DisplayInstanceEntity) },
	})
	@Expose()
	@Type(() => DisplayInstanceEntity)
	data: DisplayInstanceEntity[];
}

/**
 * Response wrapper for DisplayInstanceEntity by UID
 */
@ApiSchema({ name: 'UsersModuleResDisplayInstanceByUid' })
export class DisplayInstanceByUidResponseModel extends BaseSuccessResponseModel<DisplayInstanceEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DisplayInstanceEntity,
	})
	@Expose()
	@Type(() => DisplayInstanceEntity)
	data: DisplayInstanceEntity;
}
