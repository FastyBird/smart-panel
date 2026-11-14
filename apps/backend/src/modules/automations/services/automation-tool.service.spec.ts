import { SpacesService } from '../../spaces/services/spaces.service';
import { ToolAccessKind, ToolAudience, ToolExecutionStatus } from '../../tools/platforms/tool-provider.platform';
import { ScopedShortIdTargetKind, ShortIdMappingService } from '../../tools/services/short-id-mapping.service';
import { ToolProviderRegistryService } from '../../tools/services/tool-provider-registry.service';
import { AutomationRunStatus, AutomationStatus } from '../automations.constants';
import {
	AutomationsGraphValidationException,
	AutomationsNotFoundException,
	AutomationsNotTriggerableException,
	AutomationsRevisionConflictException,
} from '../automations.exceptions';
import { AutomationEntity } from '../entities/automations.entity';

import { AutomationEngineService } from './automation-engine.service';
import {
	AUTOMATION_TOOL_LIST_LIMIT,
	AutomationToolService,
	LIST_AUTOMATIONS_TOOL_NAME,
	RUN_AUTOMATION_TOOL_NAME,
	SET_AUTOMATION_ENABLED_TOOL_NAME,
} from './automation-tool.service';
import { AutomationsService } from './automations.service';

const AUTOMATION_ID = '0f9a6b1e-4d1c-4c7a-9a77-1f5c0d0b9e21';
const SPACE_ID = '6b0e7e7c-55a8-4f6c-8f4c-2f1f8b1fd2b0';
const CONVERSATION_ID = 'conversation-1';

const mcp = { audience: ToolAudience.MCP, source: 'mcp', actorId: 'client-1' };
const buddy = { audience: ToolAudience.BUDDY, source: ToolAudience.BUDDY, conversationId: CONVERSATION_ID };

const automation = (overrides: Partial<AutomationEntity> = {}): AutomationEntity =>
	({
		id: AUTOMATION_ID,
		name: 'Hallway light',
		description: null,
		icon: null,
		enabled: true,
		spaceId: SPACE_ID,
		mode: 'restart',
		revision: 4,
		status: AutomationStatus.OK,
		lastTriggeredAt: new Date('2026-11-10T08:00:00.000Z'),
		lastRunStatus: AutomationRunStatus.COMPLETED,
		graph: { version: 1, nodes: [{ id: 'secret-node' }], edges: [] },
		...overrides,
	}) as unknown as AutomationEntity;

describe('AutomationToolService', () => {
	let service: AutomationToolService;
	let automationsService: { findOne: jest.Mock; findSummaryPage: jest.Mock; setEnabled: jest.Mock };
	let engine: { triggerOrThrow: jest.Mock };
	let spacesService: { findOne: jest.Mock; resolveSnapshotScope: jest.Mock };
	let shortIdMapping: ShortIdMappingService;

	beforeEach(() => {
		automationsService = {
			findOne: jest.fn().mockResolvedValue(automation()),
			findSummaryPage: jest.fn().mockResolvedValue({ automations: [automation()], total: 1 }),
			setEnabled: jest.fn(),
		};
		engine = { triggerOrThrow: jest.fn().mockResolvedValue({ outcome: 'started', runId: 'run-1' }) };
		spacesService = {
			findOne: jest.fn().mockResolvedValue({ id: SPACE_ID, type: 'room' }),
			resolveSnapshotScope: jest.fn().mockResolvedValue({ sceneSpaceIds: [SPACE_ID], wholeHome: false }),
		};
		shortIdMapping = new ShortIdMappingService();
		service = new AutomationToolService(
			automationsService as unknown as AutomationsService,
			engine as unknown as AutomationEngineService,
			spacesService as unknown as SpacesService,
			shortIdMapping,
		);
	});

	describe('getToolDefinitions', () => {
		it('offers exactly the list, run and enable tools and nothing that edits a graph', () => {
			expect(service.getToolDefinitions().map((tool) => tool.name)).toEqual([
				LIST_AUTOMATIONS_TOOL_NAME,
				RUN_AUTOMATION_TOOL_NAME,
				SET_AUTOMATION_ENABLED_TOOL_NAME,
			]);
		});

		it('declares the audience and access kind of every tool', () => {
			const tools = Object.fromEntries(service.getToolDefinitions().map((tool) => [tool.name, tool]));

			expect(tools[LIST_AUTOMATIONS_TOOL_NAME].access).toBe(ToolAccessKind.READ);
			expect(tools[RUN_AUTOMATION_TOOL_NAME].access).toBe(ToolAccessKind.TRIGGER);
			expect(tools[SET_AUTOMATION_ENABLED_TOOL_NAME].access).toBe(ToolAccessKind.WRITE);

			for (const tool of Object.values(tools)) {
				expect(tool.audiences).toEqual([ToolAudience.BUDDY, ToolAudience.MCP]);
			}
		});

		it('accepts no graph, node or arbitrary input', () => {
			const properties = Object.fromEntries(
				service
					.getToolDefinitions()
					.map((tool) => [tool.name, Object.keys((tool.parameters.properties ?? {}) as Record<string, unknown>)]),
			);

			expect(properties).toEqual({
				[LIST_AUTOMATIONS_TOOL_NAME]: ['space_id', 'enabled'],
				[RUN_AUTOMATION_TOOL_NAME]: ['automation_id'],
				[SET_AUTOMATION_ENABLED_TOOL_NAME]: ['automation_id', 'enabled'],
			});
		});
	});

	describe('audience and access kind checks', () => {
		it('denies a tool to a caller that lacks its access kind', async () => {
			const list = await service.executeTool(
				{ id: 'call-1', name: LIST_AUTOMATIONS_TOOL_NAME, arguments: {} },
				{ ...mcp, allowedAccessKinds: [ToolAccessKind.TRIGGER] },
			);
			const run = await service.executeTool(
				{ id: 'call-2', name: RUN_AUTOMATION_TOOL_NAME, arguments: { automation_id: AUTOMATION_ID } },
				{ ...mcp, allowedAccessKinds: [ToolAccessKind.WRITE] },
			);
			const enable = await service.executeTool(
				{
					id: 'call-3',
					name: SET_AUTOMATION_ENABLED_TOOL_NAME,
					arguments: { automation_id: AUTOMATION_ID, enabled: true },
				},
				{ ...mcp, allowedAccessKinds: [ToolAccessKind.READ, ToolAccessKind.TRIGGER] },
			);

			expect(list).toEqual(
				expect.objectContaining({ status: ToolExecutionStatus.DENIED, errorCode: 'TOOL_ACCESS_DENIED' }),
			);
			expect(run).toEqual(
				expect.objectContaining({ status: ToolExecutionStatus.DENIED, errorCode: 'TOOL_ACCESS_DENIED' }),
			);
			expect(enable).toEqual(
				expect.objectContaining({ status: ToolExecutionStatus.DENIED, errorCode: 'TOOL_ACCESS_DENIED' }),
			);
			expect(automationsService.findSummaryPage).not.toHaveBeenCalled();
			expect(engine.triggerOrThrow).not.toHaveBeenCalled();
			expect(automationsService.setEnabled).not.toHaveBeenCalled();
		});

		it('lets the registry route each tool only to its access kind', async () => {
			const registry = new ToolProviderRegistryService();

			registry.register(service);

			expect(
				registry
					.getAllToolDefinitions({ audience: ToolAudience.MCP, accessKinds: [ToolAccessKind.READ] })
					.map((tool) => tool.name),
			).toEqual([LIST_AUTOMATIONS_TOOL_NAME]);
			expect(
				registry
					.getAllToolDefinitions({ audience: ToolAudience.MCP, accessKinds: [ToolAccessKind.TRIGGER] })
					.map((tool) => tool.name),
			).toEqual([RUN_AUTOMATION_TOOL_NAME]);
			expect(
				registry
					.getAllToolDefinitions({ audience: ToolAudience.MCP, accessKinds: [ToolAccessKind.WRITE] })
					.map((tool) => tool.name),
			).toEqual([SET_AUTOMATION_ENABLED_TOOL_NAME]);
			expect(registry.getAllToolDefinitions({ audience: ToolAudience.BUDDY }).map((tool) => tool.name)).toEqual([
				LIST_AUTOMATIONS_TOOL_NAME,
				RUN_AUTOMATION_TOOL_NAME,
				SET_AUTOMATION_ENABLED_TOOL_NAME,
			]);

			const denied = await registry.executeTool(
				{ id: 'call-1', name: RUN_AUTOMATION_TOOL_NAME, arguments: { automation_id: AUTOMATION_ID } },
				{ ...mcp, allowedAccessKinds: [ToolAccessKind.READ] },
			);

			expect(denied).toEqual(
				expect.objectContaining({ status: ToolExecutionStatus.DENIED, errorCode: 'TOOL_ACCESS_DENIED' }),
			);
			expect(engine.triggerOrThrow).not.toHaveBeenCalled();
		});

		it('does not let Buddy name an automation it was not shown in the conversation', async () => {
			const run = await service.executeTool(
				{ id: 'call-1', name: RUN_AUTOMATION_TOOL_NAME, arguments: { automation_id: AUTOMATION_ID } },
				buddy,
			);
			const enable = await service.executeTool(
				{
					id: 'call-2',
					name: SET_AUTOMATION_ENABLED_TOOL_NAME,
					arguments: { automation_id: AUTOMATION_ID, enabled: false },
				},
				buddy,
			);

			expect(run).toEqual(
				expect.objectContaining({ status: ToolExecutionStatus.DENIED, errorCode: 'BUDDY_TARGET_NOT_EXPOSED' }),
			);
			expect(enable).toEqual(
				expect.objectContaining({ status: ToolExecutionStatus.DENIED, errorCode: 'BUDDY_TARGET_NOT_EXPOSED' }),
			);
			expect(engine.triggerOrThrow).not.toHaveBeenCalled();
			expect(automationsService.setEnabled).not.toHaveBeenCalled();
		});

		it('does not resolve a token exposed in another conversation', async () => {
			const token = shortIdMapping.exposeScoped(
				'other-conversation',
				AUTOMATION_ID,
				ScopedShortIdTargetKind.AUTOMATION,
			);

			const result = await service.executeTool(
				{ id: 'call-1', name: RUN_AUTOMATION_TOOL_NAME, arguments: { automation_id: token } },
				buddy,
			);

			expect(result.errorCode).toBe('BUDDY_TARGET_NOT_EXPOSED');
			expect(engine.triggerOrThrow).not.toHaveBeenCalled();
		});
	});

	describe('list_automations', () => {
		it('returns bounded summaries without graphs for MCP', async () => {
			const result = await service.executeTool({ id: 'call-1', name: LIST_AUTOMATIONS_TOOL_NAME, arguments: {} }, mcp);

			expect(automationsService.findSummaryPage).toHaveBeenCalledWith(AUTOMATION_TOOL_LIST_LIMIT, {
				spaceIds: undefined,
				enabled: undefined,
			});
			expect(result.success).toBe(true);
			expect(result.status).toBe(ToolExecutionStatus.COMPLETED);
			expect(result.data).toEqual({
				automations: [
					{
						automation_id: AUTOMATION_ID,
						name: 'Hallway light',
						description: null,
						space_id: SPACE_ID,
						enabled: true,
						status: AutomationStatus.OK,
						last_triggered_at: '2026-11-10T08:00:00.000Z',
						last_run_status: AutomationRunStatus.COMPLETED,
					},
				],
				total: 1,
				truncated: false,
			});
			expect(JSON.stringify(result)).not.toContain('secret-node');
		});

		it('filters by space scope and enabled state', async () => {
			spacesService.resolveSnapshotScope.mockResolvedValue({
				sceneSpaceIds: [SPACE_ID, 'room-2'],
				wholeHome: false,
			});

			await service.executeTool(
				{ id: 'call-1', name: LIST_AUTOMATIONS_TOOL_NAME, arguments: { space_id: SPACE_ID, enabled: false } },
				mcp,
			);

			expect(spacesService.findOne).toHaveBeenCalledWith(SPACE_ID);
			expect(automationsService.findSummaryPage).toHaveBeenCalledWith(AUTOMATION_TOOL_LIST_LIMIT, {
				spaceIds: [SPACE_ID, 'room-2'],
				enabled: false,
			});
		});

		it('lists the whole home for the master space', async () => {
			spacesService.resolveSnapshotScope.mockResolvedValue({ deviceScope: {}, wholeHome: true });

			await service.executeTool(
				{ id: 'call-1', name: LIST_AUTOMATIONS_TOOL_NAME, arguments: { space_id: SPACE_ID } },
				mcp,
			);

			expect(automationsService.findSummaryPage).toHaveBeenCalledWith(AUTOMATION_TOOL_LIST_LIMIT, {
				spaceIds: undefined,
				enabled: undefined,
			});
		});

		it('reports an unknown space', async () => {
			spacesService.findOne.mockResolvedValue(null);

			const result = await service.executeTool(
				{ id: 'call-1', name: LIST_AUTOMATIONS_TOOL_NAME, arguments: { space_id: SPACE_ID } },
				mcp,
			);

			expect(result).toEqual(expect.objectContaining({ success: false, errorCode: 'SPACE_NOT_FOUND' }));
			expect(automationsService.findSummaryPage).not.toHaveBeenCalled();
		});

		it('rejects unknown arguments', async () => {
			const result = await service.executeTool(
				{ id: 'call-1', name: LIST_AUTOMATIONS_TOOL_NAME, arguments: { graph: {} } },
				mcp,
			);

			expect(result.errorCode).toBe('INVALID_TOOL_ARGUMENTS');
		});

		it('flags a truncated list', async () => {
			automationsService.findSummaryPage.mockResolvedValue({
				automations: [automation()],
				total: AUTOMATION_TOOL_LIST_LIMIT + 1,
			});

			const result = await service.executeTool({ id: 'call-1', name: LIST_AUTOMATIONS_TOOL_NAME, arguments: {} }, mcp);

			expect(result.data).toEqual(expect.objectContaining({ total: AUTOMATION_TOOL_LIST_LIMIT + 1, truncated: true }));
		});

		it('shows Buddy conversation-scoped references that the action tools accept', async () => {
			const list = await service.executeTool({ id: 'call-1', name: LIST_AUTOMATIONS_TOOL_NAME, arguments: {} }, buddy);
			const [entry] = (list.data as { automations: { automation_id: string; space_id: string }[] }).automations;

			expect(entry.automation_id).not.toBe(AUTOMATION_ID);
			expect(entry.space_id).not.toBe(SPACE_ID);
			expect(shortIdMapping.resolveScoped(CONVERSATION_ID, entry.space_id, ScopedShortIdTargetKind.SPACE)).toBe(
				SPACE_ID,
			);
			expect(list.message).toContain(`[id=${entry.automation_id}]`);

			const run = await service.executeTool(
				{ id: 'call-2', name: RUN_AUTOMATION_TOOL_NAME, arguments: { automation_id: entry.automation_id } },
				buddy,
			);

			expect(engine.triggerOrThrow).toHaveBeenCalledWith(AUTOMATION_ID);
			expect(run.data).toEqual(expect.objectContaining({ automation_id: entry.automation_id, run_id: 'run-1' }));
		});
	});

	describe('run_automation', () => {
		it('starts a run through the manual-run path of the engine', async () => {
			const result = await service.executeTool(
				{ id: 'call-1', name: RUN_AUTOMATION_TOOL_NAME, arguments: { automation_id: AUTOMATION_ID } },
				mcp,
			);

			expect(engine.triggerOrThrow).toHaveBeenCalledWith(AUTOMATION_ID);
			expect(result).toEqual({
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				message: 'Automation "Hallway light" was started',
				data: { automation_id: AUTOMATION_ID, started: true, outcome: 'started', run_id: 'run-1', reason: null },
			});
		});

		it('reports an automation that does not exist', async () => {
			automationsService.findOne.mockResolvedValue(null);

			const result = await service.executeTool(
				{ id: 'call-1', name: RUN_AUTOMATION_TOOL_NAME, arguments: { automation_id: AUTOMATION_ID } },
				mcp,
			);

			expect(result).toEqual(expect.objectContaining({ success: false, errorCode: 'AUTOMATION_NOT_FOUND' }));
			expect(engine.triggerOrThrow).not.toHaveBeenCalled();
		});

		it('reports an automation deleted before the run', async () => {
			engine.triggerOrThrow.mockRejectedValue(new AutomationsNotFoundException('gone'));

			const result = await service.executeTool(
				{ id: 'call-1', name: RUN_AUTOMATION_TOOL_NAME, arguments: { automation_id: AUTOMATION_ID } },
				mcp,
			);

			expect(result.errorCode).toBe('AUTOMATION_NOT_FOUND');
		});

		it.each([
			['disabled', 'AUTOMATION_DISABLED'],
			['invalid', 'AUTOMATION_INVALID'],
			['suspended', 'AUTOMATION_SUSPENDED'],
			['no_trigger', 'AUTOMATION_NO_TRIGGER'],
			['not_running', 'AUTOMATION_ENGINE_NOT_RUNNING'],
			['not_found', 'AUTOMATION_NOT_LOADED'],
		])('reports the engine refusing a %s automation', async (code, errorCode) => {
			engine.triggerOrThrow.mockRejectedValue(new AutomationsNotTriggerableException(`Refused: ${code}`, code));

			const result = await service.executeTool(
				{ id: 'call-1', name: RUN_AUTOMATION_TOOL_NAME, arguments: { automation_id: AUTOMATION_ID } },
				mcp,
			);

			expect(result).toEqual({
				success: false,
				status: ToolExecutionStatus.DENIED,
				message: `Automation "Hallway light" cannot be run: Refused: ${code}`,
				data: {
					automation_id: AUTOMATION_ID,
					started: false,
					outcome: 'refused',
					run_id: null,
					reason: `Refused: ${code}`,
				},
				errorCode,
			});
		});

		it.each([
			['ignored', 'AUTOMATION_RUN_IGNORED'],
			['dropped', 'AUTOMATION_RUN_DROPPED'],
			['suspended', 'AUTOMATION_SUSPENDED'],
		])('reports a run the mode or overload guard %s', async (outcome, errorCode) => {
			engine.triggerOrThrow.mockResolvedValue({ outcome, reason: 'Not now.' });

			const result = await service.executeTool(
				{ id: 'call-1', name: RUN_AUTOMATION_TOOL_NAME, arguments: { automation_id: AUTOMATION_ID } },
				mcp,
			);

			expect(result).toEqual(
				expect.objectContaining({
					success: false,
					status: ToolExecutionStatus.FAILED,
					errorCode,
					data: { automation_id: AUTOMATION_ID, started: false, outcome, run_id: null, reason: 'Not now.' },
				}),
			);
		});

		it('rejects a missing automation ID', async () => {
			const result = await service.executeTool({ id: 'call-1', name: RUN_AUTOMATION_TOOL_NAME, arguments: {} }, mcp);

			expect(result.errorCode).toBe('INVALID_TOOL_ARGUMENTS');
			expect(engine.triggerOrThrow).not.toHaveBeenCalled();
		});

		it('wraps an unexpected failure', async () => {
			engine.triggerOrThrow.mockRejectedValue(new Error('SQLITE_BUSY'));

			const result = await service.executeTool(
				{ id: 'call-1', name: RUN_AUTOMATION_TOOL_NAME, arguments: { automation_id: AUTOMATION_ID } },
				mcp,
			);

			expect(result).toEqual(
				expect.objectContaining({ status: ToolExecutionStatus.FAILED, errorCode: 'TOOL_EXECUTION_FAILED' }),
			);
		});
	});

	describe('set_automation_enabled', () => {
		it('switches an automation off through AutomationsService.setEnabled', async () => {
			automationsService.setEnabled.mockResolvedValue(automation({ enabled: false, revision: 5 }));

			const result = await service.executeTool(
				{
					id: 'call-1',
					name: SET_AUTOMATION_ENABLED_TOOL_NAME,
					arguments: { automation_id: AUTOMATION_ID, enabled: false },
				},
				mcp,
			);

			expect(automationsService.setEnabled).toHaveBeenCalledWith(AUTOMATION_ID, false);
			expect(result).toEqual({
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				message: 'Automation "Hallway light" was disabled',
				data: { automation_id: AUTOMATION_ID, enabled: false, changed: true, automation_status: AutomationStatus.OK },
			});
		});

		it('reports an automation already in the requested state', async () => {
			automationsService.setEnabled.mockResolvedValue(automation());

			const result = await service.executeTool(
				{
					id: 'call-1',
					name: SET_AUTOMATION_ENABLED_TOOL_NAME,
					arguments: { automation_id: AUTOMATION_ID, enabled: true },
				},
				mcp,
			);

			expect(result.message).toBe('Automation "Hallway light" is already enabled');
			expect(result.data).toEqual(expect.objectContaining({ changed: false, enabled: true }));
		});

		it('refuses to enable an automation whose graph is invalid, without leaking the issues', async () => {
			automationsService.findOne.mockResolvedValue(automation({ enabled: false }));
			automationsService.setEnabled.mockRejectedValue(
				new AutomationsGraphValidationException('The automation graph cannot be saved', [
					{ code: 'missing_trigger', message: 'secret-node needs a trigger', blocking: true },
				] as never),
			);

			const result = await service.executeTool(
				{
					id: 'call-1',
					name: SET_AUTOMATION_ENABLED_TOOL_NAME,
					arguments: { automation_id: AUTOMATION_ID, enabled: true },
				},
				mcp,
			);

			expect(result).toEqual(
				expect.objectContaining({
					success: false,
					status: ToolExecutionStatus.FAILED,
					errorCode: 'AUTOMATION_GRAPH_INVALID',
				}),
			);
			expect(result.message).not.toContain('secret-node');
		});

		it('reports an automation that does not exist', async () => {
			automationsService.findOne.mockResolvedValue(null);

			const result = await service.executeTool(
				{
					id: 'call-1',
					name: SET_AUTOMATION_ENABLED_TOOL_NAME,
					arguments: { automation_id: AUTOMATION_ID, enabled: true },
				},
				mcp,
			);

			expect(result.errorCode).toBe('AUTOMATION_NOT_FOUND');
			expect(automationsService.setEnabled).not.toHaveBeenCalled();
		});

		it('reports an automation deleted or kept busy in between', async () => {
			automationsService.setEnabled.mockRejectedValueOnce(new AutomationsNotFoundException('gone'));
			automationsService.setEnabled.mockRejectedValueOnce(new AutomationsRevisionConflictException('busy'));

			const call = {
				id: 'call-1',
				name: SET_AUTOMATION_ENABLED_TOOL_NAME,
				arguments: { automation_id: AUTOMATION_ID, enabled: false },
			};

			expect((await service.executeTool(call, mcp)).errorCode).toBe('AUTOMATION_NOT_FOUND');
			expect((await service.executeTool(call, mcp)).errorCode).toBe('AUTOMATION_CONFLICT');
		});

		it('rejects a missing enabled flag', async () => {
			const result = await service.executeTool(
				{ id: 'call-1', name: SET_AUTOMATION_ENABLED_TOOL_NAME, arguments: { automation_id: AUTOMATION_ID } },
				mcp,
			);

			expect(result.errorCode).toBe('INVALID_TOOL_ARGUMENTS');
		});
	});

	it('returns null for a tool it does not own', async () => {
		await expect(service.executeTool({ id: 'call-1', name: 'update_automation', arguments: {} }, mcp)).resolves.toBe(
			null,
		);
	});
});
