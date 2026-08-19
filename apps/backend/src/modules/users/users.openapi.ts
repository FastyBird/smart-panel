/**
 * OpenAPI extra models for Users module
 */
import { UserEntity } from './entities/users.entity';
import { UsersConfigModel } from './models/config.model';
import { BulkResultResponseModel, UserResponseModel, UsersResponseModel } from './models/users-response.model';

export const USERS_SWAGGER_EXTRA_MODELS = [
	// Module configuration
	UsersConfigModel,
	// Response models
	BulkResultResponseModel,
	UserResponseModel,
	UsersResponseModel,
	// Entities
	UserEntity,
];
