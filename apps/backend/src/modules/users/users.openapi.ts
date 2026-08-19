/**
 * OpenAPI extra models for Users module
 */
import { UserEntity } from './entities/users.entity';
import { BulkResultResponseModel, UserResponseModel, UsersResponseModel } from './models/users-response.model';

export const USERS_SWAGGER_EXTRA_MODELS = [
	// Response models
	BulkResultResponseModel,
	UserResponseModel,
	UsersResponseModel,
	// Entities
	UserEntity,
];
