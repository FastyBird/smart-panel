import { Injectable } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { PropertyCommandService } from '../../devices/services/property-command.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SceneExecutorService } from '../../scenes/services/scene-executor.service';
import { SecurityService } from '../../security/services/security.service';
import { UpdateSystemConfigDto } from '../../system/dto/update-config.dto';
import { SystemConfigModel } from '../../system/models/config.model';
import { SYSTEM_MODULE_NAME } from '../../system/system.constants';
import { AutomationNodeType } from '../graph/node-type';
import { AutomationEngineService } from '../services/automation-engine.service';
import { AutomationSafetyService } from '../services/automation-safety.service';
import { AutomationsService } from '../services/automations.service';
import { AutomationEventSourceService } from '../services/event-source.service';
import { AutomationStateTrackerService } from '../services/state-tracker.service';
import { AutomationTimeSourceService } from '../services/time-source.service';

import { allNodeType } from './all.node-type';
import { anyNodeType } from './any.node-type';
import { createAutomationDisableNodeType, createAutomationEnableNodeType } from './automation-enabled-set.node-type';
import { createAutomationRunNodeType } from './automation-run.node-type';
import { delayNodeType } from './delay.node-type';
import { createDeviceButtonPressedNodeType } from './device-button-pressed.node-type';
import { createDeviceConnectionChangedNodeType } from './device-connection-changed.node-type';
import { createDevicePropertyChangedNodeType } from './device-property-changed.node-type';
import { createDevicePropertyCompareNodeType } from './device-property-compare.node-type';
import { DevicePropertyCommander, createDevicePropertySetNodeType } from './device-property-set.node-type';
import { DevicePropertyInfo, DevicePropertyLookup } from './device-property.utils';
import { createHouseModeChangedNodeType } from './house-mode-changed.node-type';
import { createHouseModeIsNodeType } from './house-mode-is.node-type';
import { HouseModeWriter, createHouseModeSetNodeType } from './house-mode-set.node-type';
import { manualStartNodeType } from './manual-start.node-type';
import { createNotificationSendNodeType } from './notification-send.node-type';
import { createSceneRunNodeType } from './scene-run.node-type';
import { createSceneWasRunNodeType } from './scene-was-run.node-type';
import { createSecurityArmNodeType } from './security-arm.node-type';
import { createSecurityArmedIsNodeType } from './security-armed-is.node-type';
import { createSecurityStateChangedNodeType } from './security-state-changed.node-type';
import { createSunDaylightNodeType } from './sun-daylight.node-type';
import { createSunEventNodeType } from './sun-event.node-type';
import { createTimeOfDayNodeType } from './time-of-day.node-type';
import { createTimeWindowNodeType } from './time-window.node-type';
import { createWaitUntilNodeType } from './wait-until.node-type';

const idOf = (value: unknown): string | null => {
	if (typeof value === 'string') return value;

	if (typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string') {
		return (value as { id: string }).id;
	}

	return null;
};

const categoryOf = (value: unknown): string | null => {
	const category = typeof value === 'object' && value !== null ? (value as { category?: unknown }).category : null;

	return typeof category === 'string' ? category : null;
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
		category: typeof property.category === 'string' ? property.category : null,
		channelCategory: categoryOf(channel),
	};
};

/**
 * Builds the cards the automations module itself provides (ADR 0003, decision 13): the cards over the
 * core modules - devices, time, the sun, scenes, notifications, the house mode, security and automations
 * themselves - and the flow blocks: Delay, Wait until, Any and All. The cards are plain
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
		private readonly eventSource: AutomationEventSourceService,
		private readonly configService: ConfigService,
		private readonly security: SecurityService,
		private readonly automations: AutomationsService,
		private readonly engine: AutomationEngineService,
	) {}

	/** The built-in node types, to be registered by the module */
	create(): AutomationNodeType<any>[] {
		const findProperty: DevicePropertyLookup = async (propertyId) => {
			const property = await this.propertiesService.findOne(propertyId);

			return property ? toDevicePropertyInfo(property) : null;
		};

		const commands: DevicePropertyCommander = {
			// The options carry the intent context of the run: the automation as the origin
			executePropertyCommands: (items, options) => this.propertyCommands.executePropertyCommands(items, options),
		};

		const houseMode: HouseModeWriter = {
			houseMode: () => {
				try {
					return this.configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME).houseMode ?? null;
				} catch {
					return null;
				}
			},
			// The same change the panel and the admin make, so the house mode actions and its event follow
			setHouseMode: (mode) =>
				this.configService.updateModuleConfig<UpdateSystemConfigDto>(SYSTEM_MODULE_NAME, {
					type: SYSTEM_MODULE_NAME,
					house_mode: mode,
				} as UpdateSystemConfigDto),
		};

		return [
			// Triggers
			createDevicePropertyChangedNodeType({ tracker: this.stateTracker, findProperty }),
			createDeviceButtonPressedNodeType({ source: this.eventSource, findProperty }),
			createDeviceConnectionChangedNodeType(this.eventSource),
			createTimeOfDayNodeType(this.timeSource),
			createSunEventNodeType(this.timeSource),
			createSceneWasRunNodeType(this.eventSource),
			createHouseModeChangedNodeType(this.eventSource),
			createSecurityStateChangedNodeType(this.eventSource),
			manualStartNodeType,
			// Conditions
			createDevicePropertyCompareNodeType({ tracker: this.stateTracker, findProperty }),
			createTimeWindowNodeType(this.timeSource),
			createSunDaylightNodeType(this.timeSource),
			createHouseModeIsNodeType(houseMode),
			createSecurityArmedIsNodeType({
				armedState: async () => (await this.security.getStatus()).armedState ?? null,
			}),
			// Actions
			createDevicePropertySetNodeType({ commands, findProperty }),
			createSceneRunNodeType({
				// The execution context names the automation as the origin of the scene's intent, and the scene
				// runner judges the very actions it is about to execute
				triggerScene: (sceneId, triggeredBy, executionContext) =>
					this.sceneExecutor.triggerScene(sceneId, triggeredBy, executionContext, {
						guard: this.safety.sceneGuard,
					}),
			}),
			createNotificationSendNodeType(this.notifications),
			createHouseModeSetNodeType(houseMode),
			createSecurityArmNodeType({ commands, findProperty }),
			createAutomationEnableNodeType({
				findOne: (id) => this.automations.findOne(id),
				update: (id, changes) => this.automations.update(id, changes),
			}),
			createAutomationDisableNodeType({
				findOne: (id) => this.automations.findOne(id),
				update: (id, changes) => this.automations.update(id, changes),
			}),
			createAutomationRunNodeType({ triggerOrThrow: (id) => this.engine.triggerOrThrow(id) }),
			// Flow
			delayNodeType,
			createWaitUntilNodeType({ tracker: this.stateTracker, findProperty }),
			anyNodeType,
			allNodeType,
		];
	}
}
