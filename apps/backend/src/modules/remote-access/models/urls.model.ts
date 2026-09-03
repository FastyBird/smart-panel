import { Expose, Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

import { RemoteAccessEndpointModel } from './provider.model';

/**
 * The system-wide URL registry: the resolved internal URL, display-only LAN
 * candidates, the ranked external endpoint list, and the top-ranked
 * (primary) external URL other modules should suggest.
 */
@ApiSchema({ name: 'RemoteAccessModuleDataUrls' })
export class RemoteAccessUrlsModel {
	@ApiProperty({
		description: 'Resolved internal URL (absolute origin, no path)',
		type: 'string',
		example: 'http://localhost:3000',
	})
	@Expose()
	@IsString()
	internal: string;

	@ApiProperty({
		description: 'Display-only alternate ways to reach the internal URL: LAN addresses and the mDNS hostname',
		type: 'array',
		items: { type: 'string' },
		example: [],
	})
	@Expose()
	@IsArray()
	@IsString({ each: true })
	candidates: string[];

	@ApiProperty({
		description: 'Ranked external endpoints: HTTPS before HTTP, public before private, then registration order',
		type: 'array',
		items: { $ref: getSchemaPath(RemoteAccessEndpointModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => RemoteAccessEndpointModel)
	external: RemoteAccessEndpointModel[];

	@ApiPropertyOptional({
		description: 'The top-ranked external URL, offered to other modules (e.g. MCP OAuth); null when none is available',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString()
	primary: string | null;
}

/**
 * Response wrapper for RemoteAccessUrlsModel
 */
@ApiSchema({ name: 'RemoteAccessModuleResUrls' })
export class RemoteAccessUrlsResponseModel extends BaseSuccessResponseModel<RemoteAccessUrlsModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => RemoteAccessUrlsModel,
	})
	@Expose()
	declare data: RemoteAccessUrlsModel;
}
