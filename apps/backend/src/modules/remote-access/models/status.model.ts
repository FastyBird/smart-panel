import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { RemoteAccessAdvisoryModel, RemoteAccessProviderModel } from './provider.model';
import { RemoteAccessUrlsModel } from './urls.model';

/**
 * Aggregated module status: whether the module is enabled, every registered
 * provider's live status, the current URL registry, and every posture and
 * provider advisory.
 */
@ApiSchema({ name: 'RemoteAccessModuleDataStatus' })
export class RemoteAccessStatusModel {
	@ApiProperty({
		description: 'Module enabled state. Disabled: providers stop, only the internal URL resolves',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean;

	@ApiProperty({
		description: 'Every registered provider, with its live status',
		type: 'array',
		items: { $ref: getSchemaPath(RemoteAccessProviderModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => RemoteAccessProviderModel)
	providers: RemoteAccessProviderModel[];

	@ApiProperty({
		description: 'The current URL registry',
		type: () => RemoteAccessUrlsModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => RemoteAccessUrlsModel)
	urls: RemoteAccessUrlsModel;

	@ApiProperty({
		description: 'Module-level posture advisories plus every provider advisory',
		type: 'array',
		items: { $ref: getSchemaPath(RemoteAccessAdvisoryModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => RemoteAccessAdvisoryModel)
	advisories: RemoteAccessAdvisoryModel[];
}

/**
 * Response wrapper for RemoteAccessStatusModel
 */
@ApiSchema({ name: 'RemoteAccessModuleResStatus' })
export class RemoteAccessStatusResponseModel extends BaseSuccessResponseModel<RemoteAccessStatusModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => RemoteAccessStatusModel,
	})
	@Expose()
	declare data: RemoteAccessStatusModel;
}
