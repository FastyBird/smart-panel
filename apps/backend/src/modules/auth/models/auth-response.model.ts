import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { UserEntity } from '../../users/entities/users.entity';
import { TokenEntity } from '../entities/auth.entity';

import {
	CheckModel,
	DisplaySecretModel,
	LoggedInModel,
	RefreshTokenModel,
	RegisteredDisplayModel,
	TokenPairModel,
} from './auth.model';

/**
 * Response wrapper for UserEntity (profile)
 */
@ApiSchema({ name: 'AuthModuleResProfile' })
export class ProfileResponseModel extends BaseSuccessResponseModel<UserEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => UserEntity,
	})
	@Expose()
	declare data: UserEntity;
}

/**
 * Response wrapper for LoggedInModel
 */
@ApiSchema({ name: 'AuthModuleResLoggedIn' })
export class LoginResponseModel extends BaseSuccessResponseModel<LoggedInModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => LoggedInModel,
	})
	@Expose()
	declare data: LoggedInModel;
}

/**
 * Response wrapper for RefreshTokenModel
 */
@ApiSchema({ name: 'AuthModuleResRefreshToken' })
export class RefreshResponseModel extends BaseSuccessResponseModel<RefreshTokenModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => RefreshTokenModel,
	})
	@Expose()
	declare data: RefreshTokenModel;
}

/**
 * Response wrapper for RegisteredDisplayModel
 */
@ApiSchema({ name: 'AuthModuleResRegisteredDisplay' })
export class RegisterDisplayResponseModel extends BaseSuccessResponseModel<RegisteredDisplayModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => RegisteredDisplayModel,
	})
	@Expose()
	declare data: RegisteredDisplayModel;
}

/**
 * Response wrapper for CheckModel
 */
@ApiSchema({ name: 'AuthModuleResCheck' })
export class CheckResponseModel extends BaseSuccessResponseModel<CheckModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => CheckModel,
	})
	@Expose()
	declare data: CheckModel;
}

/**
 * Response wrapper for CheckModel (email check)
 */
@ApiSchema({ name: 'AuthModuleResCheckEmail' })
export class CheckEmailResponseModel extends BaseSuccessResponseModel<CheckModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => CheckModel,
	})
	@Expose()
	declare data: CheckModel;
}

/**
 * Response wrapper for CheckModel (username check)
 */
@ApiSchema({ name: 'AuthModuleResCheckUsername' })
export class CheckUsernameResponseModel extends BaseSuccessResponseModel<CheckModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => CheckModel,
	})
	@Expose()
	declare data: CheckModel;
}

/**
 * Response wrapper for DisplaySecretModel
 */
@ApiSchema({ name: 'AuthModuleResDisplaySecret' })
export class DisplaySecretResponseModel extends BaseSuccessResponseModel<DisplaySecretModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DisplaySecretModel,
	})
	@Expose()
	declare data: DisplaySecretModel;
}

/**
 * Response wrapper for TokenPairModel
 */
@ApiSchema({ name: 'AuthModuleResTokenPair' })
export class TokenPairResponseModel extends BaseSuccessResponseModel<TokenPairModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => TokenPairModel,
	})
	@Expose()
	declare data: TokenPairModel;
}

/**
 * Response wrapper for TokenEntity
 */
@ApiSchema({ name: 'AuthModuleResToken' })
export class TokenResponseModel extends BaseSuccessResponseModel<TokenEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => TokenEntity,
	})
	@Expose()
	declare data: TokenEntity;
}

/**
 * Response wrapper for array of TokenEntity
 */
@ApiSchema({ name: 'AuthModuleResTokens' })
export class TokensResponseModel extends BaseSuccessResponseModel<TokenEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(TokenEntity) },
	})
	@Expose()
	declare data: TokenEntity[];
}
