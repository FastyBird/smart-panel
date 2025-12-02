import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { DisplayInstanceEntity, UserEntity } from '../entities/users.entity';

/**
 * Response wrapper for UserEntity
 */
@ApiSchema({ name: 'UsersModuleResUser' })
export class UserResponseModel extends BaseSuccessResponseModel<UserEntity> {
	@ApiProperty({
		description: 'User entity',
		type: () => UserEntity,
	})
	@Expose()
	declare data: UserEntity;
}

/**
 * Response wrapper for array of UserEntity
 */
@ApiSchema({ name: 'UsersModuleResUsers' })
export class UsersResponseModel extends BaseSuccessResponseModel<UserEntity[]> {
	@ApiProperty({
		description: 'List of users',
		type: 'array',
		items: { $ref: getSchemaPath(UserEntity) },
	})
	@Expose()
	declare data: UserEntity[];
}

/**
 * Response wrapper for DisplayInstanceEntity
 */
@ApiSchema({ name: 'UsersModuleResDisplayInstance' })
export class DisplayInstanceResponseModel extends BaseSuccessResponseModel<DisplayInstanceEntity> {
	@ApiProperty({
		description: 'Display instance entity',
		type: () => DisplayInstanceEntity,
	})
	@Expose()
	declare data: DisplayInstanceEntity;
}

/**
 * Response wrapper for array of DisplayInstanceEntity
 */
@ApiSchema({ name: 'UsersModuleResDisplayInstances' })
export class DisplayInstancesResponseModel extends BaseSuccessResponseModel<DisplayInstanceEntity[]> {
	@ApiProperty({
		description: 'List of display instances',
		type: 'array',
		items: { $ref: getSchemaPath(DisplayInstanceEntity) },
	})
	@Expose()
	declare data: DisplayInstanceEntity[];
}

/**
 * Response wrapper for DisplayInstanceEntity by UID
 */
@ApiSchema({ name: 'UsersModuleResDisplayInstanceByUid' })
export class DisplayInstanceByUidResponseModel extends BaseSuccessResponseModel<DisplayInstanceEntity> {
	@ApiProperty({
		description: 'Display instance entity',
		type: () => DisplayInstanceEntity,
	})
	@Expose()
	declare data: DisplayInstanceEntity;
}
