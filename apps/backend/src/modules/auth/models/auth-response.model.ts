import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../common/dto/response.dto';
import { UserEntity } from '../../users/entities/users.entity';

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
	@Type(() => UserEntity)
	data: UserEntity;
}

/**
 * Response wrapper for LoggedInModel
 */
@ApiSchema({ name: 'AuthModuleResLogin' })
export class LoginResponseModel extends BaseSuccessResponseModel<LoggedInModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => LoggedInModel,
	})
	@Expose()
	@Type(() => LoggedInModel)
	data: LoggedInModel;
}

/**
 * Response wrapper for RefreshTokenModel
 */
@ApiSchema({ name: 'AuthModuleResRefresh' })
export class RefreshResponseModel extends BaseSuccessResponseModel<RefreshTokenModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => RefreshTokenModel,
	})
	@Expose()
	@Type(() => RefreshTokenModel)
	data: RefreshTokenModel;
}

/**
 * Response wrapper for RegisteredDisplayModel
 */
@ApiSchema({ name: 'AuthModuleResRegisterDisplay' })
export class RegisterDisplayResponseModel extends BaseSuccessResponseModel<RegisteredDisplayModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => RegisteredDisplayModel,
	})
	@Expose()
	@Type(() => RegisteredDisplayModel)
	data: RegisteredDisplayModel;
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
	@Type(() => CheckModel)
	data: CheckModel;
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
	@Type(() => CheckModel)
	data: CheckModel;
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
	@Type(() => CheckModel)
	data: CheckModel;
}

/**
 * Display secret schema (data part, not full response wrapper)
 */
@ApiSchema({ name: 'AuthModuleResDisplaySecret' })
export class DisplaySecretResponseModel extends DisplaySecretModel {}

/**
 * Token pair schema (same structure as LoggedInModel)
 */
@ApiSchema({ name: 'AuthModuleResTokenPair' })
export class TokenPairResponseModel extends TokenPairModel {}
