/**
 * OpenAPI extra models for Users module
 */
import { UpdateUsersConfigDto } from './dto/update-config.dto';
import { UserEntity } from './entities/users.entity';
import { UsersConfigModel } from './models/config.model';
import { BulkResultResponseModel, UserResponseModel, UsersResponseModel } from './models/users-response.model';

export const USERS_SWAGGER_EXTRA_MODELS = [
	// Module configuration
	UsersConfigModel,
	UpdateUsersConfigDto,
	// Response models
	BulkResultResponseModel,
	UserResponseModel,
	UsersResponseModel,
	// Entities
	UserEntity,
];
