import { Injectable, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { WebsocketGateway } from '../../websocket/gateway/websocket.gateway';
import { CommandClient, CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { AUTOMATIONS_MODULE_NAME, AUTOMATION_RUN_STEP_EVENT, automationWatchRoom } from '../automations.constants';
import { AutomationsNotFoundException, AutomationsNotTriggerableException } from '../automations.exceptions';
import { RunRecord, RunStep } from '../engine/run-walker';
import { createAutomationRunStepModel } from '../models/automation-run-trace.model';
import { createAutomationTriggerResultModel } from '../models/automation-trigger-result.model';
import { AutomationEngineService } from '../services/automation-engine.service';
import { AutomationRunService } from '../services/automation-run.service';
import { AutomationsService } from '../services/automations.service';

/**
 * WebSocket command event types for automations module
 */
export const AutomationsWsEventType = {
	TRIGGER_AUTOMATION: 'AutomationsModule.TriggerAutomation',
	WATCH_AUTOMATION: 'AutomationsModule.WatchAutomation',
	UNWATCH_AUTOMATION: 'AutomationsModule.UnwatchAutomation',
} as const;

/**
 * WebSocket command handler names for automations module
 */
export const AutomationsWsHandlerName = {
	TRIGGER_AUTOMATION: 'AutomationsModule.TriggerAutomationHandler',
	WATCH_AUTOMATION: 'AutomationsModule.WatchAutomationHandler',
	UNWATCH_AUTOMATION: 'AutomationsModule.UnwatchAutomationHandler',
} as const;

const ALLOWED_ROLES = [UserRole.OWNER, UserRole.ADMIN];

interface TriggerAutomationPayload {
	automation_id?: unknown;
	automationId?: unknown;
	node_id?: unknown;
	nodeId?: unknown;
}

interface WatchAutomationPayload {
	automation_id?: unknown;
	automationId?: unknown;
}

/**
 * The websocket side of automations: the commands a client sends, and the steps of a run for the clients
 * that watch it.
 *
 * `AutomationsModule.Run.Started` and `AutomationsModule.Run.Completed` go over the bus to every owner and
 * admin. The steps of a run would be noise there, so `AutomationsModule.Run.Step` is sent only to the
 * sockets that asked for one automation with `AutomationsModule.WatchAutomation`, until they send
 * `AutomationsModule.UnwatchAutomation` or disconnect. While nobody watches an automation, a step costs
 * one look at an empty room.
 */
@Injectable()
export class WebsocketExchangeListener implements OnModuleInit {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'WebsocketExchangeListener');

	constructor(
		private readonly commandEventRegistry: CommandEventRegistryService,
		private readonly engine: AutomationEngineService,
		private readonly automationsService: AutomationsService,
		private readonly runService: AutomationRunService,
		private readonly gateway: WebsocketGateway,
	) {}

	onModuleInit(): void {
		// Register command handler for starting an automation by hand
		this.commandEventRegistry.register(
			AutomationsWsEventType.TRIGGER_AUTOMATION,
			AutomationsWsHandlerName.TRIGGER_AUTOMATION,
			(user, payload) => this.handleTriggerAutomation(user, payload),
			ALLOWED_ROLES,
		);

		// Register command handlers for following the runs of one automation step by step
		this.commandEventRegistry.register(
			AutomationsWsEventType.WATCH_AUTOMATION,
			AutomationsWsHandlerName.WATCH_AUTOMATION,
			(user, payload, client) => this.handleWatchAutomation(user, payload, client),
			ALLOWED_ROLES,
		);
		this.commandEventRegistry.register(
			AutomationsWsEventType.UNWATCH_AUTOMATION,
			AutomationsWsHandlerName.UNWATCH_AUTOMATION,
			(user, payload, client) => this.handleUnwatchAutomation(user, payload, client),
			ALLOWED_ROLES,
		);

		this.runService.setStepListener((record, step) => this.handleRunStep(record, step));

		this.logger.log('Automations WebSocket exchange listener initialized');
	}

	/**
	 * Automations are owner and admin only, as on the REST API. A display never starts one, whatever role
	 * its token carries.
	 */
	private isAuthorized(user: ClientUserDto | undefined): boolean {
		if (!user || user.ownerType === TokenOwnerType.DISPLAY) {
			return false;
		}

		return ALLOWED_ROLES.includes(user.role);
	}

	private async handleTriggerAutomation(
		user: ClientUserDto | undefined,
		payload: unknown,
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			if (!this.isAuthorized(user)) {
				return { success: false, reason: 'Unauthorized: insufficient permissions' };
			}

			const body = (typeof payload === 'object' && payload !== null ? payload : {}) as TriggerAutomationPayload;
			const automationId = body.automation_id ?? body.automationId;
			const nodeId = body.node_id ?? body.nodeId;

			if (typeof automationId !== 'string' || automationId === '') {
				return { success: false, reason: 'Automation ID is required' };
			}

			if (nodeId !== undefined && nodeId !== null && typeof nodeId !== 'string') {
				return { success: false, reason: 'Node ID must be a string' };
			}

			const outcome = await this.engine.triggerOrThrow(automationId, typeof nodeId === 'string' ? nodeId : undefined);
			const result = createAutomationTriggerResultModel(automationId, outcome);

			return {
				success: result.started,
				...(result.reason !== null ? { reason: result.reason } : {}),
				data: { ...result },
			};
		} catch (error) {
			if (error instanceof AutomationsNotFoundException || error instanceof AutomationsNotTriggerableException) {
				return { success: false, reason: error.message };
			}

			const err = error as Error;

			this.logger.error(`[WS EXCHANGE LISTENER] Failed to trigger automation: ${err.message}`);

			return { success: false, reason: 'The automation could not be triggered' };
		}
	}

	private async handleWatchAutomation(
		user: ClientUserDto | undefined,
		payload: unknown,
		client: CommandClient | undefined,
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			if (!this.isAuthorized(user)) {
				return { success: false, reason: 'Unauthorized: insufficient permissions' };
			}

			const automationId = this.readAutomationId(payload);

			if (automationId === undefined || !client) {
				return { success: false, reason: 'Automation ID is required' };
			}

			// A room is joined only for an automation that exists, so a client can not open rooms at will
			if (!(await this.automationsService.findOne(automationId))) {
				return { success: false, reason: `Automation with id=${automationId} was not found.` };
			}

			await client.join(automationWatchRoom(automationId));

			return { success: true, data: { automation_id: automationId, watching: true } };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[WS EXCHANGE LISTENER] Failed to watch automation: ${err.message}`);

			return { success: false, reason: 'The automation could not be watched' };
		}
	}

	private async handleUnwatchAutomation(
		user: ClientUserDto | undefined,
		payload: unknown,
		client: CommandClient | undefined,
	): Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null> {
		try {
			if (!this.isAuthorized(user)) {
				return { success: false, reason: 'Unauthorized: insufficient permissions' };
			}

			const automationId = this.readAutomationId(payload);

			if (automationId === undefined || !client) {
				return { success: false, reason: 'Automation ID is required' };
			}

			// The automation may be gone by now; leaving a room that was never joined does nothing
			await client.leave(automationWatchRoom(automationId));

			return { success: true, data: { automation_id: automationId, watching: false } };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[WS EXCHANGE LISTENER] Failed to stop watching automation: ${err.message}`);

			return { success: false, reason: 'Watching the automation could not be stopped' };
		}
	}

	/** Called by the engine inside a run: it must be cheap while nobody watches, and it must never throw */
	private handleRunStep(record: RunRecord, step: RunStep): void {
		try {
			const room = automationWatchRoom(record.automationId);

			if (this.gateway.getRoomClientsCount(room) === 0) {
				return;
			}

			this.gateway.sendToRoom(room, AUTOMATION_RUN_STEP_EVENT, {
				automation_id: record.automationId,
				run_id: record.id,
				step: createAutomationRunStepModel(step),
			});
		} catch (error) {
			const err = error as Error;

			this.logger.warn(`[WS EXCHANGE LISTENER] Failed to send a run step: ${err.message}`);
		}
	}

	private readAutomationId(payload: unknown): string | undefined {
		const body = (typeof payload === 'object' && payload !== null ? payload : {}) as WatchAutomationPayload;
		const automationId = body.automation_id ?? body.automationId;

		return typeof automationId === 'string' && automationId !== '' ? automationId : undefined;
	}
}
