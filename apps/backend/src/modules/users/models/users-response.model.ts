import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { UserEntity } from '../entities/users.entity';

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
