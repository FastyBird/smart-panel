import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { LongLiveTokenEntity } from '../../auth/entities/auth.entity';
import { DisplayEntity } from '../entities/displays.entity';

/**
 * Response wrapper for DisplayEntity
 */
@ApiSchema({ name: 'DisplaysModuleResDisplay' })
export class DisplayResponseModel extends BaseSuccessResponseModel<DisplayEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DisplayEntity,
	})
	@Expose()
	declare data: DisplayEntity;
}

/**
 * Response wrapper for array of DisplayEntity
 */
@ApiSchema({ name: 'DisplaysModuleResDisplays' })
export class DisplaysResponseModel extends BaseSuccessResponseModel<DisplayEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(DisplayEntity) },
	})
	@Expose()
	declare data: DisplayEntity[];
}

/**
 * Display registration data containing the display and access token
 */
@ApiSchema({ name: 'DisplaysModuleDataRegistration' })
export class DisplayRegistrationDataModel {
	@ApiProperty({
		description: 'The registered display',
		type: () => DisplayEntity,
	})
	@Expose()
	@Type(() => DisplayEntity)
	display: DisplayEntity;

	@ApiProperty({
		name: 'access_token',
		description: 'Long-lived access token for the display',
		type: 'string',
		example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
	})
	@Expose({ name: 'access_token' })
	accessToken: string;
}

/**
 * Response wrapper for display registration
 */
@ApiSchema({ name: 'DisplaysModuleResDisplayRegistration' })
export class DisplayRegistrationResponseModel extends BaseSuccessResponseModel<DisplayRegistrationDataModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DisplayRegistrationDataModel,
	})
	@Expose()
	@Type(() => DisplayRegistrationDataModel)
	declare data: DisplayRegistrationDataModel;
}

/**
 * Response wrapper for array of LongLiveTokenEntity (display tokens)
 */
@ApiSchema({ name: 'DisplaysModuleResDisplayTokens' })
export class DisplayTokensResponseModel extends BaseSuccessResponseModel<LongLiveTokenEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(LongLiveTokenEntity) },
	})
	@Expose()
	@Type(() => LongLiveTokenEntity)
	declare data: LongLiveTokenEntity[];
}

/**
 * Display token refresh data containing the new access token
 */
@ApiSchema({ name: 'DisplaysModuleDataTokenRefresh' })
export class DisplayTokenRefreshDataModel {
	@ApiProperty({
		name: 'access_token',
		description: 'New long-lived access token for the display',
		type: 'string',
		example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
	})
	@Expose({ name: 'access_token' })
	accessToken: string;

	@ApiProperty({
		name: 'expires_at',
		description: 'Token expiration date',
		type: 'string',
		format: 'date-time',
		example: '2026-01-01T00:00:00.000Z',
	})
	@Expose({ name: 'expires_at' })
	expiresAt: Date;
}

/**
 * Response wrapper for display token refresh
 */
@ApiSchema({ name: 'DisplaysModuleResTokenRefresh' })
export class DisplayTokenRefreshResponseModel extends BaseSuccessResponseModel<DisplayTokenRefreshDataModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => DisplayTokenRefreshDataModel,
	})
	@Expose()
	@Type(() => DisplayTokenRefreshDataModel)
	declare data: DisplayTokenRefreshDataModel;
}
