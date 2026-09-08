import { Expose, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import {
	RemoteAccessAdvisoryModel,
	RemoteAccessEndpointModel,
} from '../../../modules/remote-access/models/provider.model';
import { RemoteAccessProviderState } from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { PrivilegedJobStatus } from '../../../modules/system/services/privileged-worker.service';
import { REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME } from '../remote-access-cloudflare-tunnel.constants';
import { CloudflareTunnelRequirementCode } from '../services/cloudflare-tunnel-managed.service';

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

const CLOUDFLARE_TUNNEL_REQUIREMENT_CODES: CloudflareTunnelRequirementCode[] = [
	'platform-supported',
	'binary-installed',
	'version-supported',
	'token-configured',
];

const CLOUDFLARE_TUNNEL_SETUP_JOB_STATES: PrivilegedJobStatus['state'][] = ['running', 'complete', 'failed', 'timeout'];

/**
 * Exact console commands (and/or a documentation link) that satisfy one
 * unsatisfied requirement on the detected system — D12's manual remedy
 * contract, mirroring `RemoteAccessTailscalePluginRequirementRemedyModel`.
 */
@ApiSchema({ name: 'RemoteAccessCloudflareTunnelPluginDataRequirementRemedy' })
export class RemoteAccessCloudflareTunnelPluginRequirementRemedyModel {
	@ApiProperty({
		description: 'Exact console commands that satisfy this requirement on the detected system',
		type: 'array',
		items: { type: 'string' },
		example: ['sudo apt-get install -y cloudflared'],
	})
	@Expose()
	@IsArray()
	@IsString({ each: true })
	commands: string[];

	@ApiPropertyOptional({
		description: 'Vendor or documentation link, present instead of commands when no exact command applies',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString()
	note: string | null;
}

/**
 * One prerequisite check surfaced to the admin ("is Cloudflare Tunnel even
 * usable on this installation"), distinct from the posture advisories a
 * connected provider reports about its current configuration.
 */
@ApiSchema({ name: 'RemoteAccessCloudflareTunnelPluginDataRequirement' })
export class RemoteAccessCloudflareTunnelPluginRequirementModel {
	@ApiProperty({
		description: 'Stable machine-readable requirement code',
		enum: CLOUDFLARE_TUNNEL_REQUIREMENT_CODES,
		example: 'binary-installed',
	})
	@Expose()
	@IsEnum(CLOUDFLARE_TUNNEL_REQUIREMENT_CODES)
	code: CloudflareTunnelRequirementCode;

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
		example: 'cloudflared 2024.6.1 is installed.',
	})
	@Expose()
	@IsString()
	message: string;

	@ApiPropertyOptional({
		description: 'Exact console commands that satisfy this requirement; null once it is satisfied',
		type: () => RemoteAccessCloudflareTunnelPluginRequirementRemedyModel,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => RemoteAccessCloudflareTunnelPluginRequirementRemedyModel)
	remedy: RemoteAccessCloudflareTunnelPluginRequirementRemedyModel | null;
}

/**
 * Last known privileged setup job (`POST /install`), so the admin setup wizard can poll
 * `GET /status` every few seconds as a fallback to the `RemoteAccessModule.Setup.Progress`
 * websocket event — mirrors `RemoteAccessTailscalePluginSetupJobModel` (D6).
 */
@ApiSchema({ name: 'RemoteAccessCloudflareTunnelPluginDataSetupJob' })
export class RemoteAccessCloudflareTunnelPluginSetupJobModel {
	@ApiProperty({
		name: 'job_id',
		description: 'Identifier of the privileged setup job this status reflects',
		type: 'string',
		example: '3fa1c2f0-9c3e-4c3b-8f0a-8f0a8f0a8f0a',
	})
	@Expose({ name: 'job_id' })
	@IsString()
	jobId: string;

	@ApiProperty({
		description: 'Current lifecycle state of the setup job',
		enum: CLOUDFLARE_TUNNEL_SETUP_JOB_STATES,
		example: 'running',
	})
	@Expose()
	@IsEnum(CLOUDFLARE_TUNNEL_SETUP_JOB_STATES)
	state: PrivilegedJobStatus['state'];

	@ApiProperty({
		description: 'Free-form step label reported by the setup script, null when none was reported yet',
		type: 'string',
		nullable: true,
		example: 'install',
	})
	@Expose()
	@IsOptional()
	@IsString()
	step: string | null;

	@ApiProperty({
		description: 'Free-form human-readable message reported by the setup script or the worker itself',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString()
	message: string | null;

	@ApiProperty({
		name: 'updated_at',
		description: 'ISO 8601 timestamp of the last status tick for this job',
		type: 'string',
		format: 'date-time',
		example: '2026-09-08T12:00:00Z',
	})
	@Expose({ name: 'updated_at' })
	@IsString()
	updatedAt: string;
}

/**
 * Whether a privileged setup job (Cloudflare Tunnel install, OS update, ...) can run on this
 * installation right now, sourced from `PlatformService.getPrivilegedWorkerSupport()` — mirrors
 * `RemoteAccessTailscalePluginPrivilegedSetupModel` (D12).
 */
@ApiSchema({ name: 'RemoteAccessCloudflareTunnelPluginDataPrivilegedSetup' })
export class RemoteAccessCloudflareTunnelPluginPrivilegedSetupModel {
	@ApiProperty({
		description: 'Whether a privileged setup job can run on this installation right now',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsBoolean()
	available: boolean;

	@ApiProperty({
		description: 'Why privileged setup is unavailable, null when it is available',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString()
	reason: string | null;
}

/**
 * Full Cloudflare Tunnel status: the generic provider status fields plus the requirements
 * checklist, the last known setup job and the privileged-setup probe result.
 */
@ApiSchema({ name: 'RemoteAccessCloudflareTunnelPluginDataStatus' })
export class RemoteAccessCloudflareTunnelPluginStatusModel {
	@ApiProperty({
		description: 'Provider plugin type identifier',
		type: 'string',
		example: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
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
		description: 'Endpoints this tunnel currently publishes',
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
		example: { hostname: 'panel.example.com', connector_id: null, ready_connections: null, version: '2024.6.1' },
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
		description: 'Posture advisories for this tunnel',
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
		example: '2026-09-08T12:00:00Z',
	})
	@Expose({ name: 'updated_at' })
	@IsString()
	updatedAt: string;

	@ApiProperty({
		description: 'Prerequisite checks for running Cloudflare Tunnel on this installation',
		type: 'array',
		items: { $ref: getSchemaPath(RemoteAccessCloudflareTunnelPluginRequirementModel) },
	})
	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => RemoteAccessCloudflareTunnelPluginRequirementModel)
	requirements: RemoteAccessCloudflareTunnelPluginRequirementModel[];

	@ApiPropertyOptional({
		description: 'Last known privileged setup job, null when none has run since this process started',
		nullable: true,
		type: () => RemoteAccessCloudflareTunnelPluginSetupJobModel,
	})
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => RemoteAccessCloudflareTunnelPluginSetupJobModel)
	setup: RemoteAccessCloudflareTunnelPluginSetupJobModel | null;

	@ApiProperty({
		name: 'privileged_setup',
		description: 'Whether a privileged setup job can run on this installation right now',
		type: () => RemoteAccessCloudflareTunnelPluginPrivilegedSetupModel,
	})
	@Expose({ name: 'privileged_setup' })
	@ValidateNested()
	@Type(() => RemoteAccessCloudflareTunnelPluginPrivilegedSetupModel)
	privilegedSetup: RemoteAccessCloudflareTunnelPluginPrivilegedSetupModel;
}

/**
 * Response wrapper for RemoteAccessCloudflareTunnelPluginStatusModel
 */
@ApiSchema({ name: 'RemoteAccessCloudflareTunnelPluginResStatus' })
export class RemoteAccessCloudflareTunnelPluginStatusResponseModel extends BaseSuccessResponseModel<RemoteAccessCloudflareTunnelPluginStatusModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => RemoteAccessCloudflareTunnelPluginStatusModel,
	})
	@Expose()
	declare data: RemoteAccessCloudflareTunnelPluginStatusModel;
}
