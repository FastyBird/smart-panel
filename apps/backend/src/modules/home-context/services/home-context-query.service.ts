import { Injectable } from '@nestjs/common';

import { DeviceConnectionStatus, DeviceEntity } from '../../devices/entities/devices.entity';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { DevicesService, VisibleDeviceSpaceCounts } from '../../devices/services/devices.service';
import { EnergyDataService } from '../../energy/services/energy-data.service';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SecurityService } from '../../security/services/security.service';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType, isFloorZoneCategory } from '../../spaces/spaces.constants';
import { WeatherService } from '../../weather/services/weather.service';
import { HomeContextInvalidCursorError } from '../home-context-pagination.errors';
import { HOME_CONTEXT_LIMIT_PROFILES } from '../home-context.constants';
import { HomeContextSpaceNotFoundError } from '../home-context.errors';
import { HomeContextSpacePageQuery, HomeSnapshotQuery } from '../models/home-context-query.model';
import {
	HomeContextSpacePageResult,
	HomeSnapshotDevice,
	HomeSnapshotEnergy,
	HomeSnapshotResult,
	HomeSnapshotSecurity,
	HomeSnapshotWeather,
} from '../models/home-context-result.model';
import { homeContextSpacePageQuerySchema, homeSnapshotQuerySchema } from '../schemas/home-context-input.schemas';
import { homeContextSpacePageResultSchema, homeSnapshotResultSchema } from '../schemas/home-context-output.schemas';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class HomeContextQueryService {
	constructor(
		private readonly spacesService: SpacesService,
		private readonly devicesService: DevicesService,
		private readonly deviceConnectionStateService: DeviceConnectionStateService,
		private readonly scenesService: ScenesService,
		private readonly weatherService: WeatherService,
		private readonly energyService: EnergyDataService,
		private readonly securityService: SecurityService,
	) {}

	async getHomeSnapshot(query: HomeSnapshotQuery): Promise<HomeSnapshotResult> {
		homeSnapshotQuerySchema.parse(query);
		const profile = HOME_CONTEXT_LIMIT_PROFILES[query.profile];
		const selectedSpace = query.spaceId ? await this.spacesService.findOne(query.spaceId) : null;

		if (query.spaceId && !selectedSpace) {
			throw new HomeContextSpaceNotFoundError(query.spaceId);
		}
		const snapshotScope = selectedSpace ? await this.spacesService.resolveSnapshotScope(selectedSpace) : null;
		const spaceCountsPromise: Promise<VisibleDeviceSpaceCounts | null> = selectedSpace
			? Promise.resolve<VisibleDeviceSpaceCounts | null>(null)
			: this.devicesService.getVisibleSpaceCounts();

		const [spacePage, devicePage, spaceCounts, scenePage, weather, energy, security] = await Promise.all([
			selectedSpace
				? Promise.resolve({ spaces: [selectedSpace], total: 1 })
				: this.spacesService.findSummaryPage(profile.spaces + 1, 0),
			selectedSpace
				? this.spacesService.findVisibleDeviceSummariesBySpace(selectedSpace.id, profile.devices)
				: this.devicesService.findVisibleSummaryPage(profile.devices),
			spaceCountsPromise,
			this.scenesService.findSummaryPage(profile.scenes, snapshotScope?.sceneSpaceIds),
			this.optional(() => this.weatherService.getPrimaryWeather()),
			this.optional(() =>
				this.getEnergySummaryData(snapshotScope?.wholeHome ? undefined : (selectedSpace ?? undefined)),
			),
			this.optional(() =>
				this.securityService.getBoundedStatus(
					profile.securityDevices,
					profile.securityChannelsPerDevice,
					profile.securityPropertiesPerChannel,
					snapshotScope?.securityDeviceScope ?? snapshotScope?.deviceScope,
				),
			),
		]);
		await this.hydrateDeviceStatusesStrict(devicePage.devices);

		const devices = devicePage.devices.filter((device) => !device.hidden);
		const spaces = spacePage.spaces.slice(0, profile.spaces);
		const scenes = scenePage.scenes;
		const scopedZoneId = selectedSpace?.type === SpaceType.ZONE ? selectedSpace.id : undefined;
		const result: HomeSnapshotResult = {
			scope: selectedSpace ? { type: 'space', id: selectedSpace.id, name: selectedSpace.name } : { type: 'home' },
			spaces: spaces.map((space) => ({
				id: space.id,
				name: space.name,
				type: space.type,
				parent_id: space.parentId,
				device_count: selectedSpace ? devicePage.total : this.getSpaceDeviceCount(space, spaceCounts, devicePage.total),
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
			weather: weather ? this.mapWeather(weather, profile.forecastDays) : null,
			energy,
			security: security
				? this.mapSecurity(
						security.status,
						profile.securityAlerts,
						security.devicesTruncated,
						security.channelsTruncated,
						security.propertiesTruncated,
					)
				: null,
			limits: {
				spaces_truncated: spacePage.total > spaces.length,
				devices_truncated: devicePage.total > devices.length,
				scenes_truncated: scenePage.total > scenes.length,
			},
		};

		homeSnapshotResultSchema.parse(result);

		return result;
	}

	async listSpaces(query: HomeContextSpacePageQuery): Promise<HomeContextSpacePageResult> {
		const offset = this.parseSpaceCursor(query.cursor);

		homeContextSpacePageQuerySchema.parse(query);
		const profile = HOME_CONTEXT_LIMIT_PROFILES[query.profile];
		const page = await this.spacesService.findSummaryPage(profile.spaces, offset);
		const spaces = page.spaces.map((space) => ({ id: space.id, name: space.name, type: space.type }));
		const nextOffset = offset + spaces.length;
		const result: HomeContextSpacePageResult = {
			spaces,
			...(nextOffset < page.total ? { nextCursor: String(nextOffset) } : {}),
		};

		homeContextSpacePageResultSchema.parse(result);

		return result;
	}

	private parseSpaceCursor(cursor?: string): number {
		if (cursor === undefined) {
			return 0;
		}
		if (!/^(0|[1-9]\d*)$/.test(cursor)) {
			throw new HomeContextInvalidCursorError(cursor);
		}

		const offset = Number(cursor);

		if (!Number.isSafeInteger(offset)) {
			throw new HomeContextInvalidCursorError(cursor);
		}

		return offset;
	}

	private async getEnergySummaryData(space?: SpaceEntity): Promise<HomeSnapshotEnergy> {
		const to = new Date();
		const from = new Date(to.getTime() - DAY_MS);

		if (!space) {
			const summary = await this.energyService.getSummary(from, to);

			return {
				scope: { type: 'home' },
				from: from.toISOString(),
				to: to.toISOString(),
				...summary,
			};
		}
		if (space.type === SpaceType.MASTER) {
			const summary = await this.energyService.getSummary(from, to);

			return {
				scope: { type: 'space', id: space.id },
				from: from.toISOString(),
				to: to.toISOString(),
				...summary,
			};
		}

		const category = (space as { category?: string | null } | undefined)?.category ?? null;
		const summary =
			space.type === SpaceType.ZONE && !isFloorZoneCategory(category)
				? await this.energyService.getDeviceZoneSummary(from, to, space.id)
				: await this.energyService.getSpaceSummary(from, to, space.id);

		return {
			scope: { type: 'space', id: space.id },
			from: from.toISOString(),
			to: to.toISOString(),
			...summary,
		};
	}

	private mapDeviceSummary(device: DeviceEntity, scopedZoneId?: string): HomeSnapshotDevice {
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

	private mapWeather(
		weather: Awaited<ReturnType<WeatherService['getPrimaryWeather']>>,
		forecastDays: number,
	): HomeSnapshotWeather {
		return {
			location_id: weather.locationId ?? null,
			location: weather.location,
			current: weather.current,
			forecast: weather.forecast.slice(0, forecastDays),
		};
	}

	private mapSecurity(
		status: Awaited<ReturnType<SecurityService['getStatus']>>,
		alertLimit: number,
		devicesTruncated = false,
		channelsTruncated = false,
		propertiesTruncated = false,
	): HomeSnapshotSecurity {
		const alerts = status.activeAlerts.slice(0, alertLimit);

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

	private async hydrateDeviceStatusesStrict(devices: DeviceEntity[]): Promise<void> {
		const statuses = await this.deviceConnectionStateService.readLatestManyStrict(devices);

		for (const device of devices) {
			const status = statuses.get(device.id);

			if (status) {
				device.status = Object.assign(device.status ?? new DeviceConnectionStatus(), status);
			}
		}
	}

	private getZoneIds(device: DeviceEntity, scopedZoneId?: string): string[] {
		return [...new Set([...(device.zoneIds ?? []), ...(scopedZoneId ? [scopedZoneId] : [])])];
	}

	private getSpaceDeviceCount(
		space: SpaceEntity,
		counts: VisibleDeviceSpaceCounts | null,
		wholeHomeTotal: number,
	): number {
		if (!counts) {
			return 0;
		}
		if (space.type === SpaceType.MASTER) {
			return wholeHomeTotal;
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

		return counts.floors[space.id] ?? 0;
	}

	private toIsoString(value: Date | string | null | undefined): string | null {
		if (!value) {
			return null;
		}

		return value instanceof Date ? value.toISOString() : value;
	}

	private async optional<T>(callback: () => Promise<T>): Promise<T | null> {
		try {
			return await callback();
		} catch {
			return null;
		}
	}
}
