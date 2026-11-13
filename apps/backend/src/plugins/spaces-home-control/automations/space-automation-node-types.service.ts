import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { AutomationNodeType } from '../../../modules/automations/graph/node-type';
import { SpaceActivityStateEntity } from '../entities/space-activity-state.entity';
import { SpaceActivityConfigService } from '../services/space-activity-config.service';
import { SpaceIntentService } from '../services/space-intent.service';
import { SpaceModeService } from '../services/space-mode.service';
import { SpaceOccupancyService } from '../services/space-occupancy.service';
import { SPACES_HOME_CONTROL_PLUGIN_NAME } from '../spaces-home-control.constants';

import { SpaceAutomationEventsService } from './space-automation-events.service';
import { describeError } from './space-cards.utils';
import { createSpaceLightingIntentNodeType } from './space-lighting-intent.node-type';
import { createSpaceModeChangedNodeType } from './space-mode-changed.node-type';
import { SpaceModeReading, createSpaceModeIsNodeType } from './space-mode-is.node-type';
import { SpaceModeActivator, createSpaceModeSetNodeType } from './space-mode-set.node-type';
import { createSpaceOccupancyChangedNodeType } from './space-occupancy-changed.node-type';
import { SpaceOccupancyReader, createSpaceOccupancyIsNodeType } from './space-occupancy-is.node-type';

/** The activity selection of a space as the cards take it; no row is no selection */
export const toSpaceModeReading = (state: SpaceActivityStateEntity | null): SpaceModeReading => ({
	mode: state?.selectedActivityMode ?? null,
	status: state?.activityStatus ?? null,
	activationId: state?.activationId ?? null,
	actor: state?.activityActor ?? null,
});

/**
 * Builds the automation cards of the plugin (ADR 0003, decision 13; design § First node catalogue): the
 * occupancy and activity mode triggers and conditions of a room or zone, and the actions that set its
 * activity mode and its lighting. The cards are plain objects that take only the part of a service they use,
 * so each of them is tested without the application; this service hands them the real services.
 *
 * Every card names the plugin as its owner. It stays registered while the plugin is disabled, but the
 * catalogue does not offer it and the engine neither arms nor executes it.
 */
@Injectable()
export class SpaceAutomationNodeTypesService {
	private readonly logger = createExtensionLogger(SPACES_HOME_CONTROL_PLUGIN_NAME, 'SpaceAutomationNodeTypesService');

	constructor(
		private readonly events: SpaceAutomationEventsService,
		private readonly occupancy: SpaceOccupancyService,
		private readonly modes: SpaceModeService,
		private readonly activityConfigs: SpaceActivityConfigService,
		private readonly spaceIntents: SpaceIntentService,
	) {}

	/** The node types of the plugin, to be registered by the plugin */
	create(): AutomationNodeType<any>[] {
		const occupancy: SpaceOccupancyReader = {
			occupancy: async (spaceId) => {
				const state = await this.occupancy.stateFor(spaceId);

				return { status: state.status, enabled: state.enabled };
			},
		};

		const modes: SpaceModeActivator = {
			activeMode: async (spaceId) => toSpaceModeReading(await this.modes.getActiveMode(spaceId)),
			modeConfiguration: async (spaceId, mode) => {
				const config = await this.activityConfigs.get(spaceId, mode);

				return { enabled: config.activityEnabled, revision: config.activityRevision };
			},
			activateMode: async (spaceId, mode, revision, actor, admission) =>
				toSpaceModeReading(
					await this.modes.activateMode(spaceId, mode, revision, actor, undefined, undefined, admission),
				),
		};

		const readFailed = (error: unknown): void => {
			this.logger.warn(`A space automation trigger could not read the state of its space: ${describeError(error)}`);
		};

		return [
			// Triggers
			createSpaceOccupancyChangedNodeType(
				{ ...occupancy, onOccupancyChanged: (spaceId, listener) => this.events.onOccupancyChanged(spaceId, listener) },
				readFailed,
			),
			createSpaceModeChangedNodeType(
				{ ...modes, onModeChanged: (spaceId, listener) => this.events.onModeChanged(spaceId, listener) },
				readFailed,
			),
			// Conditions
			createSpaceOccupancyIsNodeType(occupancy),
			createSpaceModeIsNodeType(modes),
			// Actions
			createSpaceModeSetNodeType(modes),
			createSpaceLightingIntentNodeType({
				// The execution context names the automation as the origin of the intent
				executeLightingIntent: (spaceId, intent, executionContext) =>
					this.spaceIntents.executeLightingIntent(spaceId, intent, executionContext),
			}),
		];
	}
}
