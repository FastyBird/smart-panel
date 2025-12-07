/**
 * OpenAPI extra models for Users module
 */
import { UserEntity } from './entities/users.entity';
import { UserResponseModel, UsersResponseModel } from './models/users-response.model';

export const USERS_SWAGGER_EXTRA_MODELS = [
	// Response models
	UserResponseModel,
	UsersResponseModel,
	// Entities
	UserEntity,
];
