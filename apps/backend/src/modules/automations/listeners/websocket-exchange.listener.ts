import { Injectable, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import { AutomationsNotFoundException, AutomationsNotTriggerableException } from '../automations.exceptions';
import { createAutomationTriggerResultModel } from '../models/automation-trigger-result.model';
import { AutomationEngineService } from '../services/automation-engine.service';

/**
 * WebSocket command event types for automations module
 */
export const AutomationsWsEventType = {
	TRIGGER_AUTOMATION: 'AutomationsModule.TriggerAutomation',
} as const;

/**
 * WebSocket command handler names for automations module
 */
export const AutomationsWsHandlerName = {
	TRIGGER_AUTOMATION: 'AutomationsModule.TriggerAutomationHandler',
} as const;

const ALLOWED_ROLES = [UserRole.OWNER, UserRole.ADMIN];

interface TriggerAutomationPayload {
	automation_id?: unknown;
	automationId?: unknown;
	node_id?: unknown;
	nodeId?: unknown;
}

@Injectable()
export class WebsocketExchangeListener implements OnModuleInit {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'WebsocketExchangeListener');

	constructor(
		private readonly commandEventRegistry: CommandEventRegistryService,
		private readonly engine: AutomationEngineService,
	) {}

	onModuleInit(): void {
		// Register command handler for starting an automation by hand
		this.commandEventRegistry.register(
			AutomationsWsEventType.TRIGGER_AUTOMATION,
			AutomationsWsHandlerName.TRIGGER_AUTOMATION,
			(user, payload) => this.handleTriggerAutomation(user, payload),
			ALLOWED_ROLES,
		);

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
}
