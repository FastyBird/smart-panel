import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import {
	RemoteAccessAdvisorySeverity,
	RemoteAccessEndpointScope,
	RemoteAccessProviderKind,
	RemoteAccessProviderState,
} from '../platforms/remote-access-provider.platform';

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

const REMOTE_ACCESS_PROVIDER_KINDS: RemoteAccessProviderKind[] = ['mesh', 'tunnel', 'vpn', 'external'];

const REMOTE_ACCESS_ENDPOINT_SCOPES: RemoteAccessEndpointScope[] = ['private', 'public'];

const REMOTE_ACCESS_ADVISORY_SEVERITIES: RemoteAccessAdvisorySeverity[] = ['info', 'warning', 'critical'];

/**
 * One way to reach this installation.
 */
@ApiSchema({ name: 'RemoteAccessModuleDataEndpoint' })
export class RemoteAccessEndpointModel {
	@ApiProperty({
		description: 'Absolute origin (no path)',
		type: 'string',
		example: 'https://node.tailnet.ts.net',
	})
	@Expose()
	@IsString()
	url: string;

	@ApiProperty({
		description: 'Whether this endpoint is reachable from the mesh/tunnel only, or from the public internet',
		enum: REMOTE_ACCESS_ENDPOINT_SCOPES,
		example: 'private',
	})
	@Expose()
	@IsEnum(REMOTE_ACCESS_ENDPOINT_SCOPES)
	scope: RemoteAccessEndpointScope;

	@ApiProperty({
		description: 'Whether this endpoint terminates HTTPS',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	https: boolean;

	@ApiProperty({
		description: 'Human-readable label',
		type: 'string',
		example: 'Tailscale (HTTPS)',
	})
	@Expose()
	@IsString()
	label: string;
}

/**
 * A user-facing note about the current remote-access posture, either
 * module-level or passed through from a provider's own status.
 */
@ApiSchema({ name: 'RemoteAccessModuleDataAdvisory' })
export class RemoteAccessAdvisoryModel {
	@ApiProperty({
		description: 'Stable machine-readable code',
		type: 'string',
		example: 'public-exposure',
	})
	@Expose()
	@IsString()
	code: string;

	@ApiProperty({
		description: 'Advisory severity',
		enum: REMOTE_ACCESS_ADVISORY_SEVERITIES,
		example: 'warning',
	})
	@Expose()
	@IsEnum(REMOTE_ACCESS_ADVISORY_SEVERITIES)
	severity: RemoteAccessAdvisorySeverity;

	@ApiProperty({
		description: 'Human-readable explanation',
		type: 'string',
		example: 'This installation is reachable from the public internet through at least one endpoint.',
	})
	@Expose()
	@IsString()
	message: string;

	@ApiPropertyOptional({
		description: 'Provider type this advisory came from; absent for module-level advisories',
		type: 'string',
		nullable: true,
		example: 'remote-access-tailscale-plugin',
	})
	@Expose()
	@IsOptional()
	@IsString()
	provider?: string;
}

/**
 * Static capability flags a provider declares about itself.
 */
@ApiSchema({ name: 'RemoteAccessModuleDataProviderCapabilities' })
export class RemoteAccessProviderCapabilitiesModel {
	@ApiProperty({ description: 'Whether the provider can terminate HTTPS', type: 'boolean', example: true })
	@Expose()
	@IsBoolean()
	https: boolean;

	@ApiProperty({
		name: 'public_url',
		description: 'Whether the provider can publish a publicly reachable URL',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'public_url' })
	@IsBoolean()
	publicUrl: boolean;

	@ApiProperty({
		name: 'identity_headers',
		description: 'Whether the provider can present an authenticated identity header',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'identity_headers' })
	@IsBoolean()
	identityHeaders: boolean;

	@ApiProperty({ description: 'Whether the provider offers remote shell access', type: 'boolean', example: false })
	@Expose()
	@IsBoolean()
	ssh: boolean;
}

/**
 * Merges a provider's static metadata (kind, capabilities) with its latest
 * status (state, endpoints, advisories, ...) for the REST surface.
 */
@ApiSchema({ name: 'RemoteAccessModuleDataProvider' })
export class RemoteAccessProviderModel {
	@ApiProperty({
		description: 'Provider plugin type identifier',
		type: 'string',
		example: 'remote-access-tailscale-plugin',
	})
	@Expose()
	@IsString()
	type: string;

	@ApiProperty({
		description: 'Provider transport category',
		enum: REMOTE_ACCESS_PROVIDER_KINDS,
		example: 'mesh',
	})
	@Expose()
	@IsEnum(REMOTE_ACCESS_PROVIDER_KINDS)
	kind: RemoteAccessProviderKind;

	@ApiProperty({
		description: 'Static capability flags',
		type: () => RemoteAccessProviderCapabilitiesModel,
	})
	@Expose()
	@ValidateNested()
	@Type(() => RemoteAccessProviderCapabilitiesModel)
	capabilities: RemoteAccessProviderCapabilitiesModel;

	@ApiProperty({
		description: 'Current provider state',
		enum: REMOTE_ACCESS_PROVIDER_STATES,
		example: 'connected',
	})
	@Expose()
	@IsEnum(REMOTE_ACCESS_PROVIDER_STATES)
	state: RemoteAccessProviderState;

	@ApiProperty({
		description: 'Endpoints this provider currently publishes',
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
		description: 'Advisories reported by this provider',
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
}

/**
 * Response wrapper for a single RemoteAccessProviderModel
 */
@ApiSchema({ name: 'RemoteAccessModuleResProvider' })
export class RemoteAccessProviderResponseModel extends BaseSuccessResponseModel<RemoteAccessProviderModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => RemoteAccessProviderModel,
	})
	@Expose()
	declare data: RemoteAccessProviderModel;
}

/**
 * Response wrapper for an array of RemoteAccessProviderModel
 */
@ApiSchema({ name: 'RemoteAccessModuleResProviders' })
export class RemoteAccessProvidersResponseModel extends BaseSuccessResponseModel<RemoteAccessProviderModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(RemoteAccessProviderModel) },
	})
	@Expose()
	declare data: RemoteAccessProviderModel[];
}
