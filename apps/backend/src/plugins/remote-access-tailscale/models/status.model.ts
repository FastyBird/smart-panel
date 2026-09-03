import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import {
	RemoteAccessAdvisoryModel,
	RemoteAccessEndpointModel,
} from '../../../modules/remote-access/models/provider.model';
import { RemoteAccessProviderState } from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { TailscaleRequirementCode } from '../services/tailscale-node-managed.service';

const REMOTE_ACCESS_PROVIDER_STATES: RemoteAccessProviderState[] = [
	'unsupported',
	'not-installed',
	'setup-required',
	'pending-auth',
	'pending-approval',
	'connecting',
	'connected',
	'disconnected',
	'error',
];

const TAILSCALE_REQUIREMENT_CODES: TailscaleRequirementCode[] = [
	'platform-supported',
	'binary-installed',
	'daemon-active',
	'operator-granted',
	'version-supported',
];

/**
 * One prerequisite check surfaced to the admin ("is Tailscale even usable on
 * this installation"), distinct from the posture advisories a connected
 * provider reports about its current configuration.
 */
@ApiSchema({ name: 'RemoteAccessTailscalePluginDataRequirement' })
export class RemoteAccessTailscalePluginRequirementModel {
	@ApiProperty({
		description: 'Stable machine-readable requirement code',
		enum: TAILSCALE_REQUIREMENT_CODES,
		example: 'binary-installed',
	})
	@Expose()
	@IsEnum(TAILSCALE_REQUIREMENT_CODES)
	code: TailscaleRequirementCode;

	@ApiProperty({
		description: 'Whether this requirement is currently satisfied',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	satisfied: boolean;

	@ApiProperty({
		description: 'Human-readable explanation',
		type: 'string',
		example: 'Tailscale 1.78.1 is installed.',
	})
	@Expose()
	@IsString()
	message: string;
}

/**
 * Full Tailscale node status: the generic provider status fields plus the
 * requirements list. The auth URL and QR code (RA-5) are added later as
 * additional fields on this same model, sent only while `state` is
 * `pending-auth` and only to admin/owner, with `Cache-Control: no-store`.
 */
@ApiSchema({ name: 'RemoteAccessTailscalePluginDataStatus' })
export class RemoteAccessTailscalePluginStatusModel {
	@ApiProperty({
		description: 'Provider plugin type identifier',
		type: 'string',
		example: 'remote-access-tailscale',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiProperty({
		description: 'Current provider state',
		enum: REMOTE_ACCESS_PROVIDER_STATES,
		example: 'connected',
	})
	@Expose()
	@IsEnum(REMOTE_ACCESS_PROVIDER_STATES)
	state: RemoteAccessProviderState;

	@ApiProperty({
		description: 'Endpoints this node currently publishes',
		type: 'array',
		items: { $ref: getSchemaPath(RemoteAccessEndpointModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => RemoteAccessEndpointModel)
	endpoints: RemoteAccessEndpointModel[];

	@ApiPropertyOptional({
		description: 'Human-readable detail for setup-required / error states',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString()
	message?: string | null;

	@ApiProperty({
		description: 'Provider-specific fields, safe to display verbatim',
		type: 'object',
		additionalProperties: true,
		example: {},
	})
	@Expose()
	details: Record<string, string | number | boolean | null>;

	@ApiProperty({
		name: 'proxy_addresses',
		description: 'Loopback addresses this provider proxies from while active',
		type: 'array',
		items: { type: 'string' },
		example: [],
	})
	@Expose({ name: 'proxy_addresses' })
	@IsArray()
	@IsString({ each: true })
	proxyAddresses: string[];

	@ApiProperty({
		description: 'Posture advisories for this node',
		type: 'array',
		items: { $ref: getSchemaPath(RemoteAccessAdvisoryModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => RemoteAccessAdvisoryModel)
	advisories: RemoteAccessAdvisoryModel[];

	@ApiProperty({
		name: 'updated_at',
		description: 'ISO 8601 timestamp of when this status was produced',
		type: 'string',
		format: 'date-time',
		example: '2025-01-18T12:00:00Z',
	})
	@Expose({ name: 'updated_at' })
	@IsString()
	updatedAt: string;

	@ApiProperty({
		description: 'Prerequisite checks for running Tailscale on this installation',
		type: 'array',
		items: { $ref: getSchemaPath(RemoteAccessTailscalePluginRequirementModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => RemoteAccessTailscalePluginRequirementModel)
	requirements: RemoteAccessTailscalePluginRequirementModel[];
}

/**
 * Response wrapper for RemoteAccessTailscalePluginStatusModel
 */
@ApiSchema({ name: 'RemoteAccessTailscalePluginResStatus' })
export class RemoteAccessTailscalePluginStatusResponseModel extends BaseSuccessResponseModel<RemoteAccessTailscalePluginStatusModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => RemoteAccessTailscalePluginStatusModel,
	})
	@Expose()
	declare data: RemoteAccessTailscalePluginStatusModel;
}
