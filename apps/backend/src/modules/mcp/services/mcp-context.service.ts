import { readFileSync } from 'fs';
import { resolve } from 'path';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { ChannelsService } from '../../devices/services/channels.service';
import { DevicesService, VisibleDeviceSpaceCounts } from '../../devices/services/devices.service';
import { BucketDuration, PropertyTimeseriesService } from '../../devices/services/property-timeseries.service';
import { EnergyDataService } from '../../energy/services/energy-data.service';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SecurityService } from '../../security/services/security.service';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType, isFloorZoneCategory } from '../../spaces/spaces.constants';
import { SystemConfigModel } from '../../system/models/config.model';
import { SYSTEM_MODULE_NAME } from '../../system/system.constants';
import { WeatherService } from '../../weather/services/weather.service';
import {
	MCP_MAX_CHANNELS_PER_DEVICE,
	MCP_MAX_CONTEXT_DEVICES,
	MCP_MAX_CONTEXT_SCENES,
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

@Injectable()
export class McpContextService {
	constructor(
		private readonly configService: ConfigService,
		private readonly installationService: McpInstallationService,
		private readonly spacesService: SpacesService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly propertiesService: ChannelsPropertiesService,
		private readonly timeseriesService: PropertyTimeseriesService,
		private readonly scenesService: ScenesService,
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
		const selectedSpace = spaceId ? await this.spacesService.findOne(spaceId) : null;

		if (spaceId && !selectedSpace) {
			throw new NotFoundException('Requested space does not exist');
		}
		const spaceCountsPromise: Promise<VisibleDeviceSpaceCounts | null> = selectedSpace
			? Promise.resolve<VisibleDeviceSpaceCounts | null>(null)
			: this.devicesService.getVisibleSpaceCounts();

		const [allSpaces, devicePage, spaceCounts, scenePage, weather, energy, security] = await Promise.all([
			selectedSpace ? Promise.resolve([selectedSpace]) : this.spacesService.findAll(),
			selectedSpace
				? this.spacesService.findVisibleDeviceSummariesBySpace(selectedSpace.id, MCP_MAX_CONTEXT_DEVICES)
				: this.devicesService.findVisibleSummaryPage(MCP_MAX_CONTEXT_DEVICES),
			spaceCountsPromise,
			this.scenesService.findSummaryPage(MCP_MAX_CONTEXT_SCENES, selectedSpace?.id),
			this.optional(() => this.weatherService.getPrimaryWeather()),
			this.optional(() => this.getEnergySummaryData(undefined, undefined, selectedSpace ?? undefined)),
			this.optional(() =>
				this.securityService.getBoundedStatus(
					MCP_MAX_SECURITY_DEVICES,
					MCP_MAX_SECURITY_CHANNELS_PER_DEVICE,
					MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL,
				),
			),
		]);

		const devices = devicePage.devices.filter((device) => !device.hidden);
		const spaces = allSpaces.slice(0, MCP_MAX_CONTEXT_SPACES);
		const scenes = scenePage.scenes;
		const scopedZoneId = selectedSpace?.type === SpaceType.ZONE ? selectedSpace.id : undefined;

		return {
			scope: selectedSpace ? { type: 'space', id: selectedSpace.id, name: selectedSpace.name } : { type: 'home' },
			spaces: spaces.map((space) => ({
				id: space.id,
				name: space.name,
				type: space.type,
				parent_id: space.parentId,
				device_count: selectedSpace ? devicePage.total : this.getSpaceDeviceCount(space, allSpaces, spaceCounts),
			})),
			devices: devices.map((device) => this.mapDeviceSummary(device, scopedZoneId)),
			scenes: scenes.map((scene) => ({
				id: scene.id,
				name: scene.name,
				category: scene.category,
				enabled: scene.enabled,
				triggerable: scene.triggerable,
				primary_space_id: scene.primarySpaceId,
			})),
			weather: weather ? this.mapWeather(weather) : null,
			energy,
			security: security
				? this.mapSecurity(
						security.status,
						security.devicesTruncated,
						security.channelsTruncated,
						security.propertiesTruncated,
					)
				: null,
			limits: {
				spaces_truncated: allSpaces.length > spaces.length,
				devices_truncated: devicePage.total > devices.length,
				scenes_truncated: scenePage.total > scenes.length,
			},
		};
	}

	async getDeviceState(deviceId: string): Promise<Record<string, unknown>> {
		const device = await this.devicesService.findVisibleSummaryById(deviceId);

		if (!device) {
			throw new NotFoundException('Requested device does not exist');
		}
		const channelPage = await this.channelsService.findSummaryPage(device.id, MCP_MAX_CHANNELS_PER_DEVICE);
		const properties = await this.propertiesService.findBoundedForChannels(
			channelPage.channels.map((channel) => channel.id),
			MCP_MAX_PROPERTIES_PER_CHANNEL,
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

		const result = await this.timeseriesService.queryTimeseries(property, range.from, range.to, bucket);
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

	async listSpaces(): Promise<Array<{ id: string; name: string; type: string }>> {
		const spaces = await this.spacesService.findAll();

		return spaces.slice(0, MCP_MAX_CONTEXT_SPACES).map((space) => ({
			id: space.id,
			name: space.name,
			type: space.type,
		}));
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
		const summary = !space
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

	private mapDeviceSummary(device: DeviceEntity, scopedZoneId?: string): Record<string, unknown> {
		return {
			id: device.id,
			name: device.name,
			category: device.category,
			enabled: device.enabled,
			room_id: device.roomId,
			zone_ids: this.getZoneIds(device, scopedZoneId),
			status: {
				online: device.status?.online ?? false,
				state: device.status?.status ?? 'unknown',
				last_changed: this.toIsoString(device.status?.lastChanged),
			},
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

	private getPropertyChannelId(property: ChannelPropertyEntity): string | null {
		return typeof property.channel === 'string' ? property.channel : property.channel.id;
	}

	private getZoneIds(device: DeviceEntity, scopedZoneId?: string): string[] {
		return [...new Set([...(device.zoneIds ?? []), ...(scopedZoneId ? [scopedZoneId] : [])])];
	}

	private getSpaceDeviceCount(
		space: SpaceEntity,
		allSpaces: SpaceEntity[],
		counts: VisibleDeviceSpaceCounts | null,
	): number {
		if (!counts) {
			return 0;
		}

		if (space.type === SpaceType.ROOM) {
			return counts.rooms[space.id] ?? 0;
		}

		if (space.type !== SpaceType.ZONE) {
			return 0;
		}

		const category = (space as { category?: string | null }).category ?? null;

		if (!isFloorZoneCategory(category)) {
			return counts.zones[space.id] ?? 0;
		}

		return allSpaces
			.filter((candidate) => candidate.parentId === space.id)
			.reduce((total, room) => total + (counts.rooms[room.id] ?? 0), 0);
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

	private async optional<T>(callback: () => Promise<T>): Promise<T | null> {
		try {
			return await callback();
		} catch {
			return null;
		}
	}
}
