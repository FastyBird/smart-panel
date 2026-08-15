import { readFileSync } from 'fs';
import { resolve } from 'path';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { ChannelPropertyEntity, DeviceConnectionStatus, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { ChannelsService } from '../../devices/services/channels.service';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { DevicesService } from '../../devices/services/devices.service';
import { BucketDuration, PropertyTimeseriesService } from '../../devices/services/property-timeseries.service';
import { EnergyDataService } from '../../energy/services/energy-data.service';
import { HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY } from '../../home-context/home-context.constants';
import { HomeContextSpaceNotFoundError } from '../../home-context/home-context.errors';
import { HomeContextQueryService } from '../../home-context/services/home-context-query.service';
import { SecurityService } from '../../security/services/security.service';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType, isFloorZoneCategory } from '../../spaces/spaces.constants';
import { SystemConfigModel } from '../../system/models/config.model';
import { SYSTEM_MODULE_NAME } from '../../system/system.constants';
import { WeatherService } from '../../weather/services/weather.service';
import {
	MCP_MAX_CHANNELS_PER_DEVICE,
	MCP_MAX_CONTEXT_SPACES,
	MCP_MAX_ENERGY_RANGE_DAYS,
	MCP_MAX_FORECAST_DAYS,
	MCP_MAX_PROPERTIES_PER_CHANNEL,
	MCP_MAX_SECURITY_ALERTS,
	MCP_MAX_SECURITY_CHANNELS_PER_DEVICE,
	MCP_MAX_SECURITY_DEVICES,
	MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL,
	MCP_MAX_TIMESERIES_POINTS,
	MCP_MAX_TIMESERIES_RANGE_DAYS,
	McpCapability,
} from '../mcp.constants';

import { McpInstallationService } from './mcp-installation.service';

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../../../package.json'), 'utf-8')) as {
	version: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export interface McpInstallationContext {
	id: string;
	name: string;
	version: string;
	timezone: string;
	endpoint: string | null;
	effective_capabilities: McpCapability[];
}

export interface McpSpaceSummaryPage {
	spaces: Array<{ id: string; name: string; type: string }>;
	nextCursor?: string;
}

@Injectable()
export class McpContextService {
	constructor(
		private readonly configService: ConfigService,
		private readonly installationService: McpInstallationService,
		private readonly homeContextQueryService: HomeContextQueryService,
		private readonly spacesService: SpacesService,
		private readonly devicesService: DevicesService,
		private readonly deviceConnectionStateService: DeviceConnectionStateService,
		private readonly channelsService: ChannelsService,
		private readonly propertiesService: ChannelsPropertiesService,
		private readonly timeseriesService: PropertyTimeseriesService,
		private readonly weatherService: WeatherService,
		private readonly energyService: EnergyDataService,
		private readonly securityService: SecurityService,
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
		try {
			const snapshot = await this.homeContextQueryService.getHomeSnapshot({
				profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
				...(spaceId ? { spaceId } : {}),
			});

			return snapshot as unknown as Record<string, unknown>;
		} catch (error) {
			if (error instanceof HomeContextSpaceNotFoundError) {
				throw new NotFoundException('Requested space does not exist');
			}

			throw error;
		}
	}

	async getDeviceState(deviceId: string): Promise<Record<string, unknown>> {
		const device = await this.devicesService.findVisibleSummaryById(deviceId);

		if (!device) {
			throw new NotFoundException('Requested device does not exist');
		}
		await this.hydrateDeviceStatusesStrict([device]);
		const channelPage = await this.channelsService.findSummaryPage(device.id, MCP_MAX_CHANNELS_PER_DEVICE);
		const properties = await this.propertiesService.findBoundedForChannels(
			channelPage.channels.map((channel) => channel.id),
			MCP_MAX_PROPERTIES_PER_CHANNEL,
			true,
		);
		const propertiesByChannel = new Map<string, ChannelPropertyEntity[]>();

		for (const property of properties.properties) {
			const channelId = this.getPropertyChannelId(property);

			if (channelId) {
				propertiesByChannel.set(channelId, [...(propertiesByChannel.get(channelId) ?? []), property]);
			}
		}

		device.channels = channelPage.channels.map((channel) => {
			channel.properties = propertiesByChannel.get(channel.id) ?? [];

			return channel;
		});

		return this.mapDevice(device, channelPage.total, properties.totals);
	}

	async getPropertyTimeseries(
		propertyId: string,
		from: string,
		to: string,
		bucket: BucketDuration,
	): Promise<Record<string, unknown>> {
		const range = this.validateRange(from, to, MCP_MAX_TIMESERIES_RANGE_DAYS, 'timeseries');
		const bucketMilliseconds: Record<BucketDuration, number> = {
			'1m': 60 * 1000,
			'5m': 5 * 60 * 1000,
			'15m': 15 * 60 * 1000,
			'1h': 60 * 60 * 1000,
		};
		const expectedPoints = Math.ceil((range.to.getTime() - range.from.getTime()) / bucketMilliseconds[bucket]);

		if (expectedPoints > MCP_MAX_TIMESERIES_POINTS) {
			throw new BadRequestException(`The selected timeseries bucket would exceed ${MCP_MAX_TIMESERIES_POINTS} points`);
		}

		const property = await this.propertiesService.findOne(propertyId);
		const propertyDevice = property ? this.getPropertyDevice(property) : null;

		if (!property || !propertyDevice || propertyDevice.hidden) {
			throw new NotFoundException('Requested property does not exist');
		}

		const result = await this.timeseriesService.queryTimeseriesStrict(property, range.from, range.to, bucket);
		const points = result.points.slice(0, MCP_MAX_TIMESERIES_POINTS);

		return {
			property_id: property.id,
			from: range.from.toISOString(),
			to: range.to.toISOString(),
			bucket: result.bucket,
			points,
			truncated: result.points.length > points.length,
		};
	}

	async getEnergySummary(from?: string, to?: string, spaceId?: string): Promise<Record<string, unknown>> {
		const space = spaceId ? await this.spacesService.findOne(spaceId) : null;

		if (spaceId && !space) {
			throw new NotFoundException('Requested space does not exist');
		}

		return this.getEnergySummaryData(from, to, space ?? undefined);
	}

	async getWeather(locationId?: string): Promise<Record<string, unknown>> {
		const weather = locationId
			? await this.weatherService.getWeather(locationId)
			: await this.weatherService.getPrimaryWeather();

		return this.mapWeather(weather);
	}

	async getSecurityStatus(): Promise<Record<string, unknown>> {
		const security = await this.securityService.getBoundedStatus(
			MCP_MAX_SECURITY_DEVICES,
			MCP_MAX_SECURITY_CHANNELS_PER_DEVICE,
			MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL,
		);

		return this.mapSecurity(
			security.status,
			security.devicesTruncated,
			security.channelsTruncated,
			security.propertiesTruncated,
		);
	}

	async listSpaces(cursor?: string): Promise<McpSpaceSummaryPage> {
		const offset = this.parseSpaceCursor(cursor);
		const page = await this.spacesService.findSummaryPage(MCP_MAX_CONTEXT_SPACES, offset);
		const spaces = page.spaces.map((space) => ({ id: space.id, name: space.name, type: space.type }));
		const nextOffset = offset + spaces.length;

		return {
			spaces,
			...(nextOffset < page.total ? { nextCursor: String(nextOffset) } : {}),
		};
	}

	private parseSpaceCursor(cursor?: string): number {
		if (cursor === undefined) {
			return 0;
		}
		if (!/^(0|[1-9]\d*)$/.test(cursor)) {
			throw new BadRequestException('The space resource cursor is invalid.');
		}

		const offset = Number(cursor);
		if (!Number.isSafeInteger(offset)) {
			throw new BadRequestException('The space resource cursor is invalid.');
		}

		return offset;
	}

	private async getEnergySummaryData(
		from?: string,
		to?: string,
		space?: SpaceEntity,
	): Promise<Record<string, unknown>> {
		const defaultTo = to ? new Date(to) : new Date();
		const defaultFrom = from
			? new Date(from)
			: Number.isFinite(defaultTo.getTime())
				? new Date(defaultTo.getTime() - DAY_MS)
				: new Date(Number.NaN);
		const range =
			from || to
				? this.validateRange(
						this.toDateInput(defaultFrom),
						this.toDateInput(defaultTo),
						MCP_MAX_ENERGY_RANGE_DAYS,
						'energy',
					)
				: { from: defaultFrom, to: defaultTo };
		const category = (space as { category?: string | null } | undefined)?.category ?? null;
		const summary =
			!space || space.type === SpaceType.MASTER
				? await this.energyService.getSummary(range.from, range.to)
				: space.type === SpaceType.ZONE && !isFloorZoneCategory(category)
					? await this.energyService.getDeviceZoneSummary(range.from, range.to, space.id)
					: await this.energyService.getSpaceSummary(range.from, range.to, space.id);

		return {
			scope: space ? { type: 'space', id: space.id } : { type: 'home' },
			from: range.from.toISOString(),
			to: range.to.toISOString(),
			...summary,
		};
	}

	private mapDevice(
		device: DeviceEntity,
		channelTotal = device.channels?.length ?? 0,
		propertyTotals: Record<string, number> = {},
	): Record<string, unknown> {
		const channels = (device.channels ?? []).slice(0, MCP_MAX_CHANNELS_PER_DEVICE);

		return {
			id: device.id,
			name: device.name,
			category: device.category,
			enabled: device.enabled,
			room_id: device.roomId,
			zone_ids: device.zoneIds ?? [],
			status: {
				online: device.status?.online ?? false,
				state: device.status?.status ?? 'unknown',
				last_changed: this.toIsoString(device.status?.lastChanged),
			},
			channels: channels.map((channel) => ({
				id: channel.id,
				name: channel.name,
				category: channel.category,
				properties: (channel.properties ?? []).slice(0, MCP_MAX_PROPERTIES_PER_CHANNEL).map((property) => ({
					id: property.id,
					name: property.name,
					category: property.category,
					data_type: property.dataType,
					unit: property.unit,
					value: property.value?.value ?? null,
					last_updated: property.value?.lastUpdated ?? null,
					trend: property.value?.trend ?? null,
				})),
				properties_truncated:
					(propertyTotals[channel.id] ?? channel.properties?.length ?? 0) > MCP_MAX_PROPERTIES_PER_CHANNEL,
			})),
			channels_truncated: channelTotal > MCP_MAX_CHANNELS_PER_DEVICE,
		};
	}

	private mapWeather(weather: Awaited<ReturnType<WeatherService['getPrimaryWeather']>>): Record<string, unknown> {
		return {
			location_id: weather.locationId ?? null,
			location: weather.location,
			current: weather.current,
			forecast: weather.forecast.slice(0, MCP_MAX_FORECAST_DAYS),
		};
	}

	private mapSecurity(
		status: Awaited<ReturnType<SecurityService['getStatus']>>,
		devicesTruncated = false,
		channelsTruncated = false,
		propertiesTruncated = false,
	): Record<string, unknown> {
		const alerts = status.activeAlerts.slice(0, MCP_MAX_SECURITY_ALERTS);

		return {
			armed_state: status.armedState,
			alarm_state: status.alarmState,
			highest_severity: status.highestSeverity,
			active_alerts_count: status.activeAlertsCount,
			has_critical_alert: status.hasCriticalAlert,
			active_alerts: alerts.map((alert) => ({
				id: alert.id,
				type: alert.type,
				severity: alert.severity,
				timestamp: alert.timestamp,
				acknowledged: alert.acknowledged,
				source_device_id: alert.sourceDeviceId,
				message: alert.message,
			})),
			alerts_truncated: status.activeAlerts.length > alerts.length,
			devices_truncated: devicesTruncated,
			channels_truncated: channelsTruncated,
			properties_truncated: propertiesTruncated,
			state_truncated: devicesTruncated || channelsTruncated || propertiesTruncated,
			last_event: status.lastEvent ?? null,
		};
	}

	private validateRange(fromValue: string, toValue: string, maxDays: number, label: string): { from: Date; to: Date } {
		const from = new Date(fromValue);
		const to = new Date(toValue);

		if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
			throw new BadRequestException(`The ${label} range must contain valid ascending timestamps`);
		}

		if (to.getTime() - from.getTime() > maxDays * DAY_MS) {
			throw new BadRequestException(`The ${label} range may not exceed ${maxDays} days`);
		}

		return { from, to };
	}

	private getPropertyDevice(property: ChannelPropertyEntity): DeviceEntity | null {
		const channel = property.channel;

		if (typeof channel === 'string') {
			return null;
		}

		const device = channel.device;

		return typeof device === 'string' ? null : device;
	}

	private async hydrateDeviceStatusesStrict(devices: DeviceEntity[]): Promise<void> {
		const statuses = await this.deviceConnectionStateService.readLatestManyStrict(devices);

		for (const device of devices) {
			const status = statuses.get(device.id);

			if (status) {
				device.status = Object.assign(device.status ?? new DeviceConnectionStatus(), status);
			}
		}
	}

	private getPropertyChannelId(property: ChannelPropertyEntity): string | null {
		return typeof property.channel === 'string' ? property.channel : property.channel.id;
	}

	private toIsoString(value: Date | string | null | undefined): string | null {
		if (!value) {
			return null;
		}

		return value instanceof Date ? value.toISOString() : value;
	}

	private toDateInput(value: Date): string {
		return Number.isFinite(value.getTime()) ? value.toISOString() : '';
	}
}
