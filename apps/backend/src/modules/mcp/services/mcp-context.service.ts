import { readFileSync } from 'fs';
import { resolve } from 'path';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { HomeContextInvalidCursorError } from '../../home-context/home-context-pagination.errors';
import { HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY } from '../../home-context/home-context.constants';
import { HomeContextSpaceNotFoundError } from '../../home-context/home-context.errors';
import {
	HomeStateDeviceNotFoundError,
	HomeStateInvalidRangeError,
	HomeStatePropertyNotFoundError,
	HomeStateTimeseriesPointLimitError,
} from '../../home-context/home-state.errors';
import { HomeContextSpacePageResult } from '../../home-context/models/home-context-result.model';
import { HomeTimeseriesBucket } from '../../home-context/models/home-state-query.model';
import { HomeContextQueryService } from '../../home-context/services/home-context-query.service';
import { HomeStateQueryService } from '../../home-context/services/home-state-query.service';
import { SystemConfigModel } from '../../system/models/config.model';
import { SYSTEM_MODULE_NAME } from '../../system/system.constants';
import { McpCapability } from '../mcp.constants';

import { McpInstallationService } from './mcp-installation.service';

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../../../package.json'), 'utf-8')) as {
	version: string;
};

export interface McpInstallationContext {
	id: string;
	name: string;
	version: string;
	timezone: string;
	endpoint: string | null;
	effective_capabilities: McpCapability[];
}

@Injectable()
export class McpContextService {
	constructor(
		private readonly configService: ConfigService,
		private readonly installationService: McpInstallationService,
		private readonly homeContextQueryService: HomeContextQueryService,
		private readonly homeStateQueryService: HomeStateQueryService,
	) {}

	async getInstallation(effectiveCapabilities: McpCapability[], endpoint?: string): Promise<McpInstallationContext> {
		let timezone = 'UTC';

		try {
			timezone = this.configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME).timezone;
		} catch {
			// Installation identity remains available when optional system configuration is unavailable.
		}

		return {
			id: await this.installationService.getInstallationId(),
			name: 'FastyBird Smart Panel',
			version: packageJson.version,
			timezone,
			endpoint: endpoint ?? null,
			effective_capabilities: [...effectiveCapabilities],
		};
	}

	async getHomeContext(spaceId?: string): Promise<Record<string, unknown>> {
		const result = await this.executeHomeQuery(() =>
			this.homeContextQueryService.getHomeSnapshot({
				profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
				...(spaceId ? { spaceId } : {}),
			}),
		);

		return result as unknown as Record<string, unknown>;
	}

	async getDeviceState(deviceId: string): Promise<Record<string, unknown>> {
		const result = await this.executeHomeQuery(() =>
			this.homeStateQueryService.getDeviceState({
				deviceId,
				profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
			}),
		);

		return result as unknown as Record<string, unknown>;
	}

	async getPropertyTimeseries(
		propertyId: string,
		from: string,
		to: string,
		bucket: HomeTimeseriesBucket,
	): Promise<Record<string, unknown>> {
		const result = await this.executeHomeQuery(() =>
			this.homeStateQueryService.getPropertyTimeseries({
				propertyId,
				from,
				to,
				bucket,
				profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
			}),
		);

		return result as unknown as Record<string, unknown>;
	}

	async getEnergySummary(from?: string, to?: string, spaceId?: string): Promise<Record<string, unknown>> {
		const result = await this.executeHomeQuery(() =>
			this.homeStateQueryService.getEnergySummary({
				from,
				to,
				spaceId,
				profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
			}),
		);

		return result as unknown as Record<string, unknown>;
	}

	async getWeather(locationId?: string): Promise<Record<string, unknown>> {
		const result = await this.executeHomeQuery(() =>
			this.homeStateQueryService.getWeather({
				locationId,
				profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
			}),
		);

		return result as unknown as Record<string, unknown>;
	}

	async getSecurityStatus(): Promise<Record<string, unknown>> {
		const result = await this.executeHomeQuery(() =>
			this.homeStateQueryService.getSecurityStatus({
				profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
			}),
		);

		return result as unknown as Record<string, unknown>;
	}

	async listSpaces(cursor?: string): Promise<HomeContextSpacePageResult> {
		return this.executeHomeQuery(() =>
			this.homeContextQueryService.listSpaces({
				cursor,
				profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
			}),
		);
	}

	private async executeHomeQuery<T>(callback: () => Promise<T>): Promise<T> {
		try {
			return await callback();
		} catch (error) {
			this.rethrowHomeContextError(error);
		}
	}

	private rethrowHomeContextError(error: unknown): never {
		if (error instanceof HomeContextSpaceNotFoundError) {
			throw new NotFoundException('Requested space does not exist');
		}
		if (error instanceof HomeStateDeviceNotFoundError) {
			throw new NotFoundException('Requested device does not exist');
		}
		if (error instanceof HomeStatePropertyNotFoundError) {
			throw new NotFoundException('Requested property does not exist');
		}
		if (error instanceof HomeStateInvalidRangeError || error instanceof HomeStateTimeseriesPointLimitError) {
			throw new BadRequestException(error.message);
		}
		if (error instanceof HomeContextInvalidCursorError) {
			throw new BadRequestException('The space resource cursor is invalid.');
		}

		throw error;
	}
}
