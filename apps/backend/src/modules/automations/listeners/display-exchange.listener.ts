import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { WebsocketGateway } from '../../websocket/gateway/websocket.gateway';
import { DISPLAY_INTERNAL_ROOM } from '../../websocket/websocket.constants';
import { AUTOMATIONS_MODULE_NAME, EventType } from '../automations.constants';
import { AutomationEntity } from '../entities/automations.entity';
import { AutomationSummaryModel } from '../models/automations.model';

/**
 * Keeps the wall panels' list of automations current.
 *
 * The bus events of the module go to owner and admin sockets only, with the whole automation and its graph. A
 * display lists the automations of a space and switches them on or off, so it gets the same lifecycle events -
 * created, updated (which covers enabled, status and last run), deleted and reset - under the same names, but
 * each automation without its graph, the way `GET /automations` lists it. Runs and their steps are not sent.
 */
@Injectable()
export class DisplayExchangeListener {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'DisplayExchangeListener');

	constructor(private readonly gateway: WebsocketGateway) {}

	@OnEvent(EventType.AUTOMATION_CREATED)
	handleCreated(automation: AutomationEntity): void {
		this.sendSummary(EventType.AUTOMATION_CREATED, automation);
	}

	@OnEvent(EventType.AUTOMATION_UPDATED)
	handleUpdated(automation: AutomationEntity): void {
		this.sendSummary(EventType.AUTOMATION_UPDATED, automation);
	}

	@OnEvent(EventType.AUTOMATION_DELETED)
	handleDeleted(payload: { id: string }): void {
		this.send(EventType.AUTOMATION_DELETED, { id: payload.id });
	}

	@OnEvent(EventType.MODULE_RESET)
	handleReset(): void {
		this.send(EventType.MODULE_RESET, {});
	}

	private sendSummary(event: EventType, automation: AutomationEntity): void {
		try {
			this.send(event, toInstance(AutomationSummaryModel, automation) as unknown as Record<string, unknown>);
		} catch (error) {
			const err = error as Error;

			this.logger.warn(`[DISPLAY EXCHANGE] Failed to prepare ${event} for displays: ${err.message}`);
		}
	}

	private send(event: EventType, payload: Record<string, unknown>): void {
		try {
			this.gateway.sendToRoom(DISPLAY_INTERNAL_ROOM, event, payload);
		} catch (error) {
			const err = error as Error;

			this.logger.warn(`[DISPLAY EXCHANGE] Failed to send ${event} to displays: ${err.message}`);
		}
	}
}
