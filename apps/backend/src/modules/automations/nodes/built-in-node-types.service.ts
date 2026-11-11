import { Injectable } from '@nestjs/common';

import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { PropertyCommandService } from '../../devices/services/property-command.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SceneExecutorService } from '../../scenes/services/scene-executor.service';
import { AutomationNodeType } from '../graph/node-type';
import { AutomationSafetyService } from '../services/automation-safety.service';
import { AutomationStateTrackerService } from '../services/state-tracker.service';
import { AutomationTimeSourceService } from '../services/time-source.service';

import { delayNodeType } from './delay.node-type';
import { createDevicePropertyChangedNodeType } from './device-property-changed.node-type';
import { createDevicePropertyCompareNodeType } from './device-property-compare.node-type';
import { createDevicePropertySetNodeType } from './device-property-set.node-type';
import { DevicePropertyInfo, DevicePropertyLookup } from './device-property.utils';
import { manualStartNodeType } from './manual-start.node-type';
import { createNotificationSendNodeType } from './notification-send.node-type';
import { createSceneRunNodeType } from './scene-run.node-type';
import { createTimeOfDayNodeType } from './time-of-day.node-type';
import { createTimeWindowNodeType } from './time-window.node-type';

const idOf = (value: unknown): string | null => {
	if (typeof value === 'string') return value;

	if (typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string') {
		return (value as { id: string }).id;
	}

	return null;
};

/** What the device cards need to know about a property, read from its entity */
export const toDevicePropertyInfo = (property: ChannelPropertyEntity): DevicePropertyInfo => {
	const channel = property.channel as unknown;
	const device = typeof channel === 'object' && channel !== null ? (channel as { device?: unknown }).device : undefined;

	return {
		id: property.id,
		channelId: idOf(channel),
		deviceId: idOf(device),
		dataType: property.dataType,
		format: property.format ?? null,
		invalid: property.invalid ?? null,
		step: property.step ?? null,
		permissions: Array.isArray(property.permissions) ? property.permissions : [],
	};
};

/**
 * Builds the cards the automations module itself provides (ADR 0003, decision 13): the cards over the
 * core modules - devices, time, scenes and notifications - and the Delay block. The cards are plain
 * objects that take only the part of a service they use, so each of them is tested without the
 * application; this service hands them the real services.
 */
@Injectable()
export class AutomationBuiltInNodeTypesService {
	constructor(
		private readonly stateTracker: AutomationStateTrackerService,
		private readonly timeSource: AutomationTimeSourceService,
		private readonly propertiesService: ChannelsPropertiesService,
		private readonly propertyCommands: PropertyCommandService,
		private readonly sceneExecutor: SceneExecutorService,
		private readonly notifications: NotificationsService,
		private readonly safety: AutomationSafetyService,
	) {}

	/** The built-in node types, to be registered by the module */
	create(): AutomationNodeType<any>[] {
		const findProperty: DevicePropertyLookup = async (propertyId) => {
			const property = await this.propertiesService.findOne(propertyId);

			return property ? toDevicePropertyInfo(property) : null;
		};

		return [
			// Triggers
			createDevicePropertyChangedNodeType({ tracker: this.stateTracker, findProperty }),
			createTimeOfDayNodeType(this.timeSource),
			manualStartNodeType,
			// Conditions
			createDevicePropertyCompareNodeType({ tracker: this.stateTracker, findProperty }),
			createTimeWindowNodeType(this.timeSource),
			// Actions
			createDevicePropertySetNodeType({
				commands: {
					// The intent origin of an automation is added with the command context (AU-7)
					executePropertyCommands: (commands) => this.propertyCommands.executePropertyCommands(commands),
				},
				findProperty,
			}),
			createSceneRunNodeType({
				// The scene runner judges the very actions it is about to execute; the intent origin of an
				// automation is added with the execution context (AU-7)
				triggerScene: (sceneId, triggeredBy) =>
					this.sceneExecutor.triggerScene(sceneId, triggeredBy, undefined, { guard: this.safety.sceneGuard }),
			}),
			createNotificationSendNodeType(this.notifications),
			// Flow
			delayNodeType,
		];
	}
}
