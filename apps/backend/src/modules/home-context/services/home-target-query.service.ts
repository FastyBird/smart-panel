import { Injectable } from '@nestjs/common';

import { ConnectionState, PermissionType } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { resolvePropertyUnit } from '../../devices/utils/property-metadata.utils';
import { SceneSummaryPage, ScenesService } from '../../scenes/services/scenes.service';
import { SpaceSummaryPage, SpacesService } from '../../spaces/services/spaces.service';
import { HOME_CONTEXT_LIMIT_PROFILES, HOME_TARGET_LIGHTING_MODES } from '../home-context.constants';
import { HomeTriggerTargetsQuery, HomeWritablePropertiesQuery } from '../models/home-target-query.model';
import {
	HomeTriggerTargetsResult,
	HomeWritablePropertiesResult,
	HomeWritablePropertyResult,
} from '../models/home-target-result.model';
import { homeTriggerTargetsQuerySchema, homeWritablePropertiesQuerySchema } from '../schemas/home-target-input.schemas';
import {
	homeTriggerTargetsResultSchema,
	homeWritablePropertiesResultSchema,
} from '../schemas/home-target-output.schemas';

@Injectable()
export class HomeTargetQueryService {
	constructor(
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectionStateService: DeviceConnectionStateService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly scenesService: ScenesService,
		private readonly spacesService: SpacesService,
	) {}

	async getWritableProperties(query: HomeWritablePropertiesQuery): Promise<HomeWritablePropertiesResult> {
		homeWritablePropertiesQuerySchema.parse(query);
		const limits = HOME_CONTEXT_LIMIT_PROFILES[query.profile];
		const actionable = await this.findActionableWritableProperties(
			limits.writableProperties,
			limits.writablePropertyCandidates,
		);
		const result: HomeWritablePropertiesResult = {
			properties: actionable.slice(0, limits.writableProperties).map((property) => this.toWritableProperty(property)),
			truncated: actionable.length > limits.writableProperties,
		};

		homeWritablePropertiesResultSchema.parse(result);

		return result;
	}

	async getTriggerTargets(query: HomeTriggerTargetsQuery): Promise<HomeTriggerTargetsResult> {
		homeTriggerTargetsQuerySchema.parse(query);
		const limits = HOME_CONTEXT_LIMIT_PROFILES[query.profile];
		const emptyScenePage: SceneSummaryPage = { scenes: [], total: 0 };
		const emptySpacePage: SpaceSummaryPage = { spaces: [], total: 0 };
		const [scenePage, spacePage] = await Promise.all([
			query.includeScenes
				? this.scenesService.findTriggerableSummaryPage(limits.triggerScenes)
				: Promise.resolve(emptyScenePage),
			query.includeSpaces
				? this.spacesService.findLightingTriggerSummaryPage(limits.triggerSpaces)
				: Promise.resolve(emptySpacePage),
		]);
		const result: HomeTriggerTargetsResult = {
			scenes: scenePage.scenes
				.filter((scene) => scene.enabled && scene.triggerable)
				.map((scene) => ({
					scene_id: scene.id,
					name: scene.name,
					category: scene.category,
					primary_space_id: scene.primarySpaceId,
				})),
			spaces: spacePage.spaces.map((space) => ({
				space_id: space.id,
				name: space.name,
				type: space.type,
				modes: [...HOME_TARGET_LIGHTING_MODES],
			})),
			truncated: {
				scenes: scenePage.total > limits.triggerScenes,
				spaces: spacePage.total > limits.triggerSpaces,
			},
		};

		homeTriggerTargetsResultSchema.parse(result);

		return result;
	}

	private async findActionableWritableProperties(
		propertyLimit: number,
		candidateLimit: number,
	): Promise<ChannelPropertyEntity[]> {
		const actionable: ChannelPropertyEntity[] = [];
		let offset = 0;

		while (true) {
			const candidates = await this.channelsPropertiesService.findWritableCandidates(candidateLimit, offset);

			if (candidates.properties.length === 0) {
				return actionable;
			}

			offset += candidates.properties.length;
			const devices = this.uniqueDevices(candidates.properties);
			const availableDevices = devices.filter(
				(device) => device.enabled && !device.hidden && this.platformRegistryService.get(device) !== null,
			);
			const availableDeviceIds = new Set(availableDevices.map((device) => device.id));
			const statuses = await this.deviceConnectionStateService.readLatestMany(availableDevices);

			for (const property of candidates.properties) {
				const device = this.getDevice(property);
				const status = statuses.get(device.id);

				if (
					availableDeviceIds.has(device.id) &&
					property.permissions.some((permission) =>
						[PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(permission),
					) &&
					(status === undefined || status.online || status.status === ConnectionState.UNKNOWN)
				) {
					actionable.push(property);

					if (actionable.length > propertyLimit) {
						return actionable;
					}
				}
			}

			if (offset >= candidates.total) {
				return actionable;
			}
		}
	}

	private uniqueDevices(properties: ChannelPropertyEntity[]): DeviceEntity[] {
		return [
			...new Map(
				properties.map((property) => {
					const device = this.getDevice(property);

					return [device.id, device];
				}),
			).values(),
		];
	}

	private toWritableProperty(property: ChannelPropertyEntity): HomeWritablePropertyResult {
		const channel = property.channel as ChannelEntity;
		const device = channel.device as DeviceEntity;

		return {
			property_id: property.id,
			property_name: property.name,
			property_category: property.category,
			device_id: device.id,
			device_name: device.name,
			channel_id: channel.id,
			channel_name: channel.name,
			channel_category: channel.category,
			data_type: property.dataType,
			unit: resolvePropertyUnit(property),
			format: property.format,
			step: property.step,
			invalid: property.invalid,
		};
	}

	private getDevice(property: ChannelPropertyEntity): DeviceEntity {
		return (property.channel as ChannelEntity).device as DeviceEntity;
	}
}
