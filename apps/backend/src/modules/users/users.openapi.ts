/**
 * OpenAPI extra models for Users module
 */
import { Type } from '@nestjs/common';

import { DisplayInstanceEntity, UserEntity } from './entities/users.entity';
import {
	DisplayInstanceByUidResponseModel,
	DisplayInstanceResponseModel,
	DisplayInstancesResponseModel,
	UserResponseModel,
	UsersResponseModel,
} from './models/users-response.model';

export const USERS_SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Response models
	UserResponseModel,
	UsersResponseModel,
	DisplayInstanceResponseModel,
	DisplayInstancesResponseModel,
	DisplayInstanceByUidResponseModel,
	// Entities
	UserEntity,
	DisplayInstanceEntity,
];
