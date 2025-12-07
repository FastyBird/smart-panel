import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { UserEntity } from '../../users/entities/users.entity';
import { AccessTokenEntity, LongLiveTokenEntity, RefreshTokenEntity, TokenEntity } from '../entities/auth.entity';

import { CheckModel, LoggedInModel, RefreshTokenModel, TokenPairModel } from './auth.model';

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
		oneOf: [
			{ $ref: getSchemaPath(AccessTokenEntity) },
			{ $ref: getSchemaPath(RefreshTokenEntity) },
			{ $ref: getSchemaPath(LongLiveTokenEntity) },
		],
		discriminator: {
			propertyName: 'type',
			mapping: {
				access: getSchemaPath(AccessTokenEntity),
				refresh: getSchemaPath(RefreshTokenEntity),
				long_live: getSchemaPath(LongLiveTokenEntity),
			},
		},
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
		items: {
			oneOf: [
				{ $ref: getSchemaPath(AccessTokenEntity) },
				{ $ref: getSchemaPath(RefreshTokenEntity) },
				{ $ref: getSchemaPath(LongLiveTokenEntity) },
			],
			discriminator: {
				propertyName: 'type',
				mapping: {
					access: getSchemaPath(AccessTokenEntity),
					refresh: getSchemaPath(RefreshTokenEntity),
					long_live: getSchemaPath(LongLiveTokenEntity),
				},
			},
		},
	})
	@Expose()
	declare data: TokenEntity[];
}
