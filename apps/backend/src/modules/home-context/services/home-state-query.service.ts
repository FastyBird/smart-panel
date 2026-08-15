import { Injectable } from '@nestjs/common';

import { ChannelPropertyEntity, DeviceConnectionStatus, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { ChannelsService } from '../../devices/services/channels.service';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { DevicesService } from '../../devices/services/devices.service';
import { BucketDuration, PropertyTimeseriesService } from '../../devices/services/property-timeseries.service';
import { EnergyDataService } from '../../energy/services/energy-data.service';
import { SecurityService } from '../../security/services/security.service';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType, isFloorZoneCategory } from '../../spaces/spaces.constants';
import { WeatherService } from '../../weather/services/weather.service';
import { HOME_CONTEXT_LIMIT_PROFILES } from '../home-context.constants';
import { HomeContextSpaceNotFoundError } from '../home-context.errors';
import {
	HomeStateDeviceNotFoundError,
	HomeStateInvalidRangeError,
	HomeStatePropertyNotFoundError,
	HomeStateRangeDomain,
	HomeStateTimeseriesPointLimitError,
} from '../home-state.errors';
import {
	HomeDeviceStateQuery,
	HomeEnergySummaryQuery,
	HomePropertyTimeseriesQuery,
	HomeSecurityStatusQuery,
	HomeWeatherQuery,
} from '../models/home-state-query.model';
import {
	HomeDeviceStateResult,
	HomeEnergySummaryResult,
	HomePropertyTimeseriesResult,
	HomeSecurityStatusResult,
	HomeWeatherResult,
} from '../models/home-state-result.model';
import {
	homeDeviceStateQuerySchema,
	homeEnergySummaryQuerySchema,
	homePropertyTimeseriesQuerySchema,
	homeSecurityStatusQuerySchema,
	homeWeatherQuerySchema,
} from '../schemas/home-state-input.schemas';
import {
	homeDeviceStateResultSchema,
	homeEnergySummaryResultSchema,
	homePropertyTimeseriesResultSchema,
	homeSecurityStatusResultSchema,
	homeWeatherResultSchema,
} from '../schemas/home-state-output.schemas';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class HomeStateQueryService {
	constructor(
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

	async getDeviceState(query: HomeDeviceStateQuery): Promise<HomeDeviceStateResult> {
		homeDeviceStateQuerySchema.parse(query);
		const limits = HOME_CONTEXT_LIMIT_PROFILES[query.profile];
		const device = await this.devicesService.findVisibleSummaryById(query.deviceId);

		if (!device) {
			throw new HomeStateDeviceNotFoundError(query.deviceId);
		}
		await this.hydrateDeviceStatusesStrict([device]);
		const channelPage = await this.channelsService.findSummaryPage(device.id, limits.channelsPerDevice);
		const properties = await this.propertiesService.findBoundedForChannels(
			channelPage.channels.map((channel) => channel.id),
			limits.propertiesPerChannel,
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
		const result = this.mapDevice(
			device,
			limits.channelsPerDevice,
			limits.propertiesPerChannel,
			channelPage.total,
			properties.totals,
		);

		homeDeviceStateResultSchema.parse(result);

		return result;
	}

	async getPropertyTimeseries(query: HomePropertyTimeseriesQuery): Promise<HomePropertyTimeseriesResult> {
		homePropertyTimeseriesQuerySchema.parse(query);
		const limits = HOME_CONTEXT_LIMIT_PROFILES[query.profile];
		const range = this.validateRange(query.from, query.to, limits.timeseriesRangeDays, 'timeseries');
		const bucketMilliseconds: Record<BucketDuration, number> = {
			'1m': 60 * 1000,
			'5m': 5 * 60 * 1000,
			'15m': 15 * 60 * 1000,
			'1h': 60 * 60 * 1000,
		};
		const expectedPoints = Math.ceil((range.to.getTime() - range.from.getTime()) / bucketMilliseconds[query.bucket]);

		if (expectedPoints > limits.timeseriesPoints) {
			throw new HomeStateTimeseriesPointLimitError(limits.timeseriesPoints);
		}

		const property = await this.propertiesService.findOne(query.propertyId);
		const propertyDevice = property ? this.getPropertyDevice(property) : null;

		if (!property || !propertyDevice || propertyDevice.hidden) {
			throw new HomeStatePropertyNotFoundError(query.propertyId);
		}

		const series = await this.timeseriesService.queryTimeseriesStrict(property, range.from, range.to, query.bucket);
		const points = series.points.slice(0, limits.timeseriesPoints);
		const result: HomePropertyTimeseriesResult = {
			property_id: property.id,
			from: range.from.toISOString(),
			to: range.to.toISOString(),
			bucket: series.bucket,
			points,
			truncated: series.points.length > points.length,
		};

		homePropertyTimeseriesResultSchema.parse(result);

		return result;
	}

	async getEnergySummary(query: HomeEnergySummaryQuery): Promise<HomeEnergySummaryResult> {
		homeEnergySummaryQuerySchema.parse(query);
		const limits = HOME_CONTEXT_LIMIT_PROFILES[query.profile];
		const space = query.spaceId ? await this.spacesService.findOne(query.spaceId) : null;

		if (query.spaceId && !space) {
			throw new HomeContextSpaceNotFoundError(query.spaceId);
		}
		const defaultTo = query.to ? new Date(query.to) : new Date();
		const defaultFrom = query.from
			? new Date(query.from)
			: Number.isFinite(defaultTo.getTime())
				? new Date(defaultTo.getTime() - DAY_MS)
				: new Date(Number.NaN);
		const range =
			query.from || query.to
				? this.validateRange(
						this.toDateInput(defaultFrom),
						this.toDateInput(defaultTo),
						limits.energyRangeDays,
						'energy',
					)
				: { from: defaultFrom, to: defaultTo };
		const category = (space as { category?: string | null } | null)?.category ?? null;
		const summary =
			!space || space.type === SpaceType.MASTER
				? await this.energyService.getSummary(range.from, range.to)
				: space.type === SpaceType.ZONE && !isFloorZoneCategory(category)
					? await this.energyService.getDeviceZoneSummary(range.from, range.to, space.id)
					: await this.energyService.getSpaceSummary(range.from, range.to, space.id);
		const result = {
			scope: space ? { type: 'space', id: space.id } : { type: 'home' },
			from: range.from.toISOString(),
			to: range.to.toISOString(),
			...summary,
		} as HomeEnergySummaryResult;

		homeEnergySummaryResultSchema.parse(result);

		return result;
	}

	async getWeather(query: HomeWeatherQuery): Promise<HomeWeatherResult> {
		homeWeatherQuerySchema.parse(query);
		const limits = HOME_CONTEXT_LIMIT_PROFILES[query.profile];
		const weather = query.locationId
			? await this.weatherService.getWeather(query.locationId)
			: await this.weatherService.getPrimaryWeather();
		const result: HomeWeatherResult = {
			location_id: weather.locationId ?? null,
			location: weather.location,
			current: weather.current,
			forecast: weather.forecast.slice(0, limits.forecastDays),
		};

		homeWeatherResultSchema.parse(result);

		return result;
	}

	async getSecurityStatus(query: HomeSecurityStatusQuery): Promise<HomeSecurityStatusResult> {
		homeSecurityStatusQuerySchema.parse(query);
		const limits = HOME_CONTEXT_LIMIT_PROFILES[query.profile];
		const security = await this.securityService.getBoundedStatus(
			limits.securityDevices,
			limits.securityChannelsPerDevice,
			limits.securityPropertiesPerChannel,
		);
		const alerts = security.status.activeAlerts.slice(0, limits.securityAlerts);
		const result: HomeSecurityStatusResult = {
			armed_state: security.status.armedState,
			alarm_state: security.status.alarmState,
			highest_severity: security.status.highestSeverity,
			active_alerts_count: security.status.activeAlertsCount,
			has_critical_alert: security.status.hasCriticalAlert,
			active_alerts: alerts.map((alert) => ({
				id: alert.id,
				type: alert.type,
				severity: alert.severity,
				timestamp: alert.timestamp,
				acknowledged: alert.acknowledged,
				source_device_id: alert.sourceDeviceId,
				message: alert.message,
			})),
			alerts_truncated: security.status.activeAlerts.length > alerts.length,
			devices_truncated: security.devicesTruncated,
			channels_truncated: security.channelsTruncated,
			properties_truncated: security.propertiesTruncated,
			state_truncated: security.devicesTruncated || security.channelsTruncated || security.propertiesTruncated,
			last_event: security.status.lastEvent ?? null,
		};

		homeSecurityStatusResultSchema.parse(result);

		return result;
	}

	private mapDevice(
		device: DeviceEntity,
		channelLimit: number,
		propertyLimit: number,
		channelTotal = device.channels?.length ?? 0,
		propertyTotals: Record<string, number> = {},
	): HomeDeviceStateResult {
		const channels = (device.channels ?? []).slice(0, channelLimit);

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
				properties: (channel.properties ?? []).slice(0, propertyLimit).map((property) => ({
					id: property.id,
					name: property.name,
					category: property.category,
					data_type: property.dataType,
					unit: property.unit,
					value: property.value?.value ?? null,
					last_updated: property.value?.lastUpdated ?? null,
					trend: property.value?.trend ?? null,
				})),
				properties_truncated: (propertyTotals[channel.id] ?? channel.properties?.length ?? 0) > propertyLimit,
			})),
			channels_truncated: channelTotal > channelLimit,
		};
	}

	private validateRange(
		fromValue: string,
		toValue: string,
		maxDays: number,
		domain: HomeStateRangeDomain,
	): { from: Date; to: Date } {
		const from = new Date(fromValue);
		const to = new Date(toValue);

		if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
			throw new HomeStateInvalidRangeError(domain, 'invalid_or_non_ascending');
		}

		if (to.getTime() - from.getTime() > maxDays * DAY_MS) {
			throw new HomeStateInvalidRangeError(domain, 'max_days_exceeded', maxDays);
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
