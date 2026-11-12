import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { WebsocketGateway } from '../../websocket/gateway/websocket.gateway';
import { CommandClient, CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { AutomationsNotFoundException, AutomationsNotTriggerableException } from '../automations.exceptions';
import { RunRecord, RunStep } from '../engine/run-walker';
import { AutomationEngineService } from '../services/automation-engine.service';
import { AutomationRunService, AutomationRunStepListener } from '../services/automation-run.service';
import { AutomationsService } from '../services/automations.service';

import {
	AutomationsWsEventType,
	AutomationsWsHandlerName,
	WebsocketExchangeListener,
} from './websocket-exchange.listener';

type Handler = (
	user: ClientUserDto | undefined,
	payload: unknown,
	client?: CommandClient,
) => Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null>;

describe('Automations WebsocketExchangeListener', () => {
	const ID = '11111111-1111-4111-8111-111111111111';

	let registry: CommandEventRegistryService;
	let triggerOrThrow: jest.Mock;
	let handler: Handler;
	let findOne: jest.Mock;
	let stepListener: AutomationRunStepListener | undefined;
	let watchers: number;
	let sendToRoom: jest.Mock;
	let getRoomClientsCount: jest.Mock;

	const user = (role: UserRole, extra: Partial<ClientUserDto> = {}): ClientUserDto =>
		({ id: 'user-1', role, type: 'user', ...extra }) as ClientUserDto;

	beforeEach(() => {
		registry = new CommandEventRegistryService();
		triggerOrThrow = jest.fn(() => Promise.resolve({ outcome: 'started', runId: 'run-1' }));

		findOne = jest.fn((id: string) => Promise.resolve(id === ID ? { id } : null));
		stepListener = undefined;
		watchers = 0;
		sendToRoom = jest.fn();
		getRoomClientsCount = jest.fn(() => watchers);

		new WebsocketExchangeListener(
			registry,
			{ triggerOrThrow } as unknown as AutomationEngineService,
			{ findOne } as unknown as AutomationsService,
			{
				setStepListener: (listener: AutomationRunStepListener | undefined) => {
					stepListener = listener;
				},
			} as unknown as AutomationRunService,
			{ sendToRoom, getRoomClientsCount } as unknown as WebsocketGateway,
		).onModuleInit();

		handler = registry.get(AutomationsWsEventType.TRIGGER_AUTOMATION)[0].handler as Handler;
	});

	it('registers the command for owners and admins only', () => {
		expect(AutomationsWsEventType.TRIGGER_AUTOMATION).toBe('AutomationsModule.TriggerAutomation');
		expect(registry.get(AutomationsWsEventType.TRIGGER_AUTOMATION)).toEqual([
			expect.objectContaining({
				name: AutomationsWsHandlerName.TRIGGER_AUTOMATION,
				requiredRoles: [UserRole.OWNER, UserRole.ADMIN],
			}),
		]);
	});

	it.each([UserRole.OWNER, UserRole.ADMIN])('starts a run for role %s', async (role) => {
		const result = await handler(user(role), { automation_id: ID, node_id: 'n1' });

		expect(triggerOrThrow).toHaveBeenCalledWith(ID, 'n1');
		expect(result).toEqual({
			success: true,
			data: { automation_id: ID, started: true, outcome: 'started', run_id: 'run-1', reason: null },
		});
	});

	it('takes the identifiers in camel case too and leaves the start node out when it is not given', async () => {
		await handler(user(UserRole.OWNER), { automationId: ID });

		expect(triggerOrThrow).toHaveBeenCalledWith(ID, undefined);
	});

	it('refuses users without the role, displays and anonymous clients', async () => {
		const refused = { success: false, reason: 'Unauthorized: insufficient permissions' };

		expect(await handler(user(UserRole.USER), { automation_id: ID })).toEqual(refused);
		expect(
			await handler(user(UserRole.ADMIN, { type: 'token', ownerType: TokenOwnerType.DISPLAY }), { automation_id: ID }),
		).toEqual(refused);
		expect(await handler(undefined, { automation_id: ID })).toEqual(refused);
		expect(triggerOrThrow).not.toHaveBeenCalled();
	});

	it('refuses a payload without an automation or with a start node that is not a string', async () => {
		expect(await handler(user(UserRole.OWNER), {})).toEqual({ success: false, reason: 'Automation ID is required' });
		expect(await handler(user(UserRole.OWNER), null)).toEqual({ success: false, reason: 'Automation ID is required' });
		expect(await handler(user(UserRole.OWNER), { automation_id: ID, node_id: 5 })).toEqual({
			success: false,
			reason: 'Node ID must be a string',
		});
		expect(triggerOrThrow).not.toHaveBeenCalled();
	});

	it('answers without success when no run was started, with the reason', async () => {
		triggerOrThrow.mockResolvedValue({ outcome: 'ignored', reason: 'A run is already active and the mode is single.' });

		expect(await handler(user(UserRole.OWNER), { automation_id: ID })).toEqual({
			success: false,
			reason: 'A run is already active and the mode is single.',
			data: {
				automation_id: ID,
				started: false,
				outcome: 'ignored',
				run_id: null,
				reason: 'A run is already active and the mode is single.',
			},
		});
	});

	it('answers with the reason when the run is refused or the automation does not exist', async () => {
		triggerOrThrow.mockRejectedValue(new AutomationsNotTriggerableException('The automation is disabled.', 'disabled'));

		expect(await handler(user(UserRole.OWNER), { automation_id: ID })).toEqual({
			success: false,
			reason: 'The automation is disabled.',
		});

		triggerOrThrow.mockRejectedValue(new AutomationsNotFoundException(`Automation with id=${ID} was not found.`));

		expect(await handler(user(UserRole.OWNER), { automation_id: ID })).toMatchObject({ success: false });
	});

	it('does not leak an unexpected failure', async () => {
		triggerOrThrow.mockRejectedValue(new Error('SQLITE_BUSY: database is locked'));

		expect(await handler(user(UserRole.OWNER), { automation_id: ID })).toEqual({
			success: false,
			reason: 'The automation could not be triggered',
		});
	});

	describe('watching an automation', () => {
		const ROOM = `automation-${ID}`;

		let watch: Handler;
		let unwatch: Handler;
		let client: { id: string; join: jest.Mock; leave: jest.Mock };

		beforeEach(() => {
			watch = registry.get(AutomationsWsEventType.WATCH_AUTOMATION)[0].handler as Handler;
			unwatch = registry.get(AutomationsWsEventType.UNWATCH_AUTOMATION)[0].handler as Handler;
			client = {
				id: 'socket-1',
				join: jest.fn(() => Promise.resolve()),
				leave: jest.fn(() => Promise.resolve()),
			};
		});

		it('registers both commands for owners and admins only', () => {
			expect(AutomationsWsEventType.WATCH_AUTOMATION).toBe('AutomationsModule.WatchAutomation');
			expect(AutomationsWsEventType.UNWATCH_AUTOMATION).toBe('AutomationsModule.UnwatchAutomation');

			for (const [event, name] of [
				[AutomationsWsEventType.WATCH_AUTOMATION, AutomationsWsHandlerName.WATCH_AUTOMATION],
				[AutomationsWsEventType.UNWATCH_AUTOMATION, AutomationsWsHandlerName.UNWATCH_AUTOMATION],
			]) {
				expect(registry.get(event)).toEqual([
					expect.objectContaining({ name, requiredRoles: [UserRole.OWNER, UserRole.ADMIN] }),
				]);
			}
		});

		it.each([UserRole.OWNER, UserRole.ADMIN])(
			'puts the socket of a %s into the room of the automation',
			async (role) => {
				expect(await watch(user(role), { automation_id: ID }, client)).toEqual({
					success: true,
					data: { automation_id: ID, watching: true },
				});
				expect(client.join).toHaveBeenCalledWith(ROOM);
			},
		);

		it('takes the socket out of the room again, also when the automation is gone', async () => {
			findOne.mockResolvedValue(null);

			expect(await unwatch(user(UserRole.OWNER), { automationId: ID }, client)).toEqual({
				success: true,
				data: { automation_id: ID, watching: false },
			});
			expect(client.leave).toHaveBeenCalledWith(ROOM);
			expect(findOne).not.toHaveBeenCalled();
		});

		it('does not join the room when the socket stopped watching while the automation was looked up', async () => {
			let found: (value: { id: string }) => void = () => undefined;

			findOne.mockReturnValueOnce(new Promise((resolve) => (found = resolve)));

			const pending = watch(user(UserRole.OWNER), { automation_id: ID }, client);

			expect(await unwatch(user(UserRole.OWNER), { automation_id: ID }, client)).toEqual({
				success: true,
				data: { automation_id: ID, watching: false },
			});

			found({ id: ID });

			expect(await pending).toEqual({
				success: false,
				reason: 'Watching the automation was stopped before it started',
			});
			expect(client.join).not.toHaveBeenCalled();

			// A later watch of the same socket is not affected
			expect(await watch(user(UserRole.OWNER), { automation_id: ID }, client)).toMatchObject({ success: true });
			expect(client.join).toHaveBeenCalledWith(ROOM);
		});

		it('an unwatch of another socket or automation leaves a pending watch alone', async () => {
			let found: (value: { id: string }) => void = () => undefined;

			findOne.mockReturnValueOnce(new Promise((resolve) => (found = resolve)));

			const pending = watch(user(UserRole.OWNER), { automation_id: ID }, client);
			const other = { id: 'socket-2', join: jest.fn(() => Promise.resolve()), leave: jest.fn(() => Promise.resolve()) };

			await unwatch(user(UserRole.OWNER), { automation_id: ID }, other);
			await unwatch(user(UserRole.OWNER), { automation_id: '22222222-2222-4222-8222-222222222222' }, client);

			found({ id: ID });

			expect(await pending).toMatchObject({ success: true });
			expect(client.join).toHaveBeenCalledWith(ROOM);
		});

		it('opens no room for users without the role, displays and anonymous clients', async () => {
			const refused = { success: false, reason: 'Unauthorized: insufficient permissions' };
			const display = user(UserRole.ADMIN, { type: 'token', ownerType: TokenOwnerType.DISPLAY });

			expect(await watch(user(UserRole.USER), { automation_id: ID }, client)).toEqual(refused);
			expect(await watch(display, { automation_id: ID }, client)).toEqual(refused);
			expect(await watch(undefined, { automation_id: ID }, client)).toEqual(refused);
			expect(await unwatch(user(UserRole.USER), { automation_id: ID }, client)).toEqual(refused);
			expect(client.join).not.toHaveBeenCalled();
			expect(client.leave).not.toHaveBeenCalled();
		});

		it('opens no room for an automation that does not exist or is not named', async () => {
			const other = '22222222-2222-4222-8222-222222222222';

			expect(await watch(user(UserRole.OWNER), { automation_id: other }, client)).toEqual({
				success: false,
				reason: `Automation with id=${other} was not found.`,
			});
			expect(await watch(user(UserRole.OWNER), {}, client)).toEqual({
				success: false,
				reason: 'Automation ID is required',
			});
			expect(await watch(user(UserRole.OWNER), { automation_id: 5 }, client)).toMatchObject({ success: false });
			expect(client.join).not.toHaveBeenCalled();
		});

		it('does not leak a failure of the socket', async () => {
			client.join.mockRejectedValue(new Error('adapter closed'));
			client.leave.mockRejectedValue(new Error('adapter closed'));

			expect(await watch(user(UserRole.OWNER), { automation_id: ID }, client)).toEqual({
				success: false,
				reason: 'The automation could not be watched',
			});
			expect(await unwatch(user(UserRole.OWNER), { automation_id: ID }, client)).toEqual({
				success: false,
				reason: 'Watching the automation could not be stopped',
			});
		});

		describe('steps of a run', () => {
			const record = { id: 'run-1', automationId: ID } as RunRecord;
			const step: RunStep = {
				seq: 2,
				at: Date.UTC(2026, 10, 11, 7, 30),
				elapsedMs: 12,
				nodeId: 'c',
				type: 'device.property.compare',
				kind: 'condition',
				via: 'e1',
				state: 'done',
				output: 'no',
				observed: { value: null },
				reason: 'The device is offline.',
			};

			it('are sent to the room of the automation while somebody watches it', () => {
				watchers = 1;

				stepListener?.(record, step);

				expect(getRoomClientsCount).toHaveBeenCalledWith(ROOM);
				expect(sendToRoom).toHaveBeenCalledTimes(1);
				expect(sendToRoom).toHaveBeenCalledWith(ROOM, 'AutomationsModule.Run.Step', {
					automation_id: ID,
					run_id: 'run-1',
					step: {
						seq: 2,
						at: '2026-11-11T07:30:00.000Z',
						elapsed_ms: 12,
						node_id: 'c',
						type: 'device.property.compare',
						kind: 'condition',
						via: 'e1',
						state: 'done',
						output: 'no',
						observed: { value: null },
						reason: 'The device is offline.',
					},
				});
			});

			it('are sent to nobody while nobody watches the automation', () => {
				stepListener?.(record, step);

				expect(sendToRoom).not.toHaveBeenCalled();
			});

			it('never fail the run they belong to', () => {
				watchers = 1;
				sendToRoom.mockImplementation(() => {
					throw new Error('server closed');
				});

				expect(stepListener).toEqual(expect.any(Function));
				expect(() => stepListener?.(record, step)).not.toThrow();
			});
		});
	});
});
