import { instanceToPlain } from 'class-transformer';

import { WebsocketGateway } from '../../websocket/gateway/websocket.gateway';
import { DISPLAY_INTERNAL_ROOM } from '../../websocket/websocket.constants';
import { AutomationMode, AutomationStatus, EventType } from '../automations.constants';
import { AutomationEntity } from '../entities/automations.entity';
import { AutomationSummaryModel } from '../models/automations.model';

import { DisplayExchangeListener } from './display-exchange.listener';

describe('Automations DisplayExchangeListener', () => {
	const ID = '11111111-1111-4111-8111-111111111111';
	const SPACE_ID = '22222222-2222-4222-8222-222222222222';

	let sendToRoom: jest.Mock;
	let listener: DisplayExchangeListener;

	const automation = (): AutomationEntity =>
		Object.assign(new AutomationEntity(), {
			id: ID,
			name: 'Hallway motion light',
			description: null,
			icon: null,
			enabled: true,
			spaceId: SPACE_ID,
			mode: AutomationMode.RESTART,
			graph: { version: 1, nodes: [{ id: 'n1', type: 'secret', position: { x: 0, y: 0 }, config: {} }], edges: [] },
			revision: 4,
			status: AutomationStatus.SUSPENDED,
			lastTriggeredAt: null,
			lastRunStatus: null,
			createdAt: new Date('2026-11-01T00:00:00Z'),
			updatedAt: null,
		});

	beforeEach(() => {
		sendToRoom = jest.fn();
		listener = new DisplayExchangeListener({ sendToRoom } as unknown as WebsocketGateway);
	});

	it.each([
		['created', EventType.AUTOMATION_CREATED, (entity: AutomationEntity) => listener.handleCreated(entity)],
		['updated', EventType.AUTOMATION_UPDATED, (entity: AutomationEntity) => listener.handleUpdated(entity)],
	])('sends a %s automation to the displays without its graph', (_label, event, handle) => {
		handle(automation());

		expect(sendToRoom).toHaveBeenCalledTimes(1);

		const [room, sentEvent, payload] = sendToRoom.mock.calls[0] as [string, string, unknown];

		expect(room).toBe(DISPLAY_INTERNAL_ROOM);
		expect(sentEvent).toBe(event);
		expect(payload).toBeInstanceOf(AutomationSummaryModel);

		const plain = instanceToPlain(payload, { excludeExtraneousValues: true });

		expect(plain).toMatchObject({
			id: ID,
			name: 'Hallway motion light',
			enabled: true,
			space_id: SPACE_ID,
			status: AutomationStatus.SUSPENDED,
			revision: 4,
		});
		expect(plain).not.toHaveProperty('graph');
	});

	it('sends the id of a deleted automation', () => {
		listener.handleDeleted({ id: ID });

		expect(sendToRoom).toHaveBeenCalledWith(DISPLAY_INTERNAL_ROOM, EventType.AUTOMATION_DELETED, { id: ID });
	});

	it('tells the displays that every automation is gone after a reset', () => {
		listener.handleReset();

		expect(sendToRoom).toHaveBeenCalledWith(DISPLAY_INTERNAL_ROOM, EventType.MODULE_RESET, {});
	});

	it('never throws into the emitter when the gateway fails', () => {
		sendToRoom.mockImplementation(() => {
			throw new Error('socket server gone');
		});

		expect(() => listener.handleUpdated(automation())).not.toThrow();
		expect(() => listener.handleDeleted({ id: ID })).not.toThrow();
	});
});
