import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { CommandEventRegistryService } from '../../websocket/services/command-event-registry.service';
import { AutomationsNotFoundException, AutomationsNotTriggerableException } from '../automations.exceptions';
import { AutomationEngineService } from '../services/automation-engine.service';

import {
	AutomationsWsEventType,
	AutomationsWsHandlerName,
	WebsocketExchangeListener,
} from './websocket-exchange.listener';

type Handler = (
	user: ClientUserDto | undefined,
	payload: unknown,
) => Promise<{ success: boolean; reason?: string; data?: Record<string, unknown> } | null>;

describe('Automations WebsocketExchangeListener', () => {
	const ID = '11111111-1111-4111-8111-111111111111';

	let registry: CommandEventRegistryService;
	let triggerOrThrow: jest.Mock;
	let handler: Handler;

	const user = (role: UserRole, extra: Partial<ClientUserDto> = {}): ClientUserDto =>
		({ id: 'user-1', role, type: 'user', ...extra }) as ClientUserDto;

	beforeEach(() => {
		registry = new CommandEventRegistryService();
		triggerOrThrow = jest.fn(() => Promise.resolve({ outcome: 'started', runId: 'run-1' }));

		new WebsocketExchangeListener(registry, { triggerOrThrow } as unknown as AutomationEngineService).onModuleInit();

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
});
