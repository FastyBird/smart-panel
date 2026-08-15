import { ChannelCategory, DataTypeType, PropertyCategory } from '../../devices/devices.constants';
import {
	HOME_CURRENT_STATE_PROFILE_BUDDY_V1,
	HOME_SEARCH_PROFILE_BUDDY_V1,
} from '../../home-context/home-context.constants';
import { HomeContextSpaceNotFoundError } from '../../home-context/home-context.errors';
import { HomeSearchInvalidCursorError } from '../../home-context/home-search.errors';
import { HomeCurrentStateResult } from '../../home-context/models/home-current-state-result.model';
import { HomeEntitySearchResponse } from '../../home-context/models/home-search-result.model';
import { HomeCurrentStateQueryService } from '../../home-context/services/home-current-state-query.service';
import { HomeSearchQueryService } from '../../home-context/services/home-search-query.service';
import { ToolAccessKind, ToolAudience, ToolExecutionStatus } from '../../tools/platforms/tool-provider.platform';
import { ToolProviderRegistryService } from '../../tools/services/tool-provider-registry.service';
import { MessageRole } from '../buddy.constants';
import { buildAnthropicRequestPayload } from '../platforms/anthropic-sdk.utils';

import {
	BUDDY_CURRENT_STATE_MAX_EVIDENCE_ROWS,
	BUDDY_HOME_READ_TOOLS_PROVIDER,
	HomeContextToolProviderService,
	QUERY_HOME_STATE_TOOL_NAME,
	SEARCH_HOME_TOOL_NAME,
	queryHomeStateToolInputSchema,
	searchHomeToolInputSchema,
} from './home-context-tool-provider.service';

describe('HomeContextToolProviderService', () => {
	const observedAt = '2026-08-15T12:00:00.000Z';
	let searchEntities: jest.MockedFunction<HomeSearchQueryService['searchEntities']>;
	let queryCurrentState: jest.MockedFunction<HomeCurrentStateQueryService['queryCurrentState']>;
	let provider: HomeContextToolProviderService;

	beforeEach(() => {
		searchEntities = jest.fn();
		queryCurrentState = jest.fn();
		provider = new HomeContextToolProviderService(
			{ searchEntities } as unknown as HomeSearchQueryService,
			{ queryCurrentState } as unknown as HomeCurrentStateQueryService,
		);
	});

	it('publishes exactly two Buddy-only READ tools with server-owned profiles', () => {
		const definitions = provider.getToolDefinitions();
		const stateDefinition = definitions[1];

		expect(provider.getType()).toBe(BUDDY_HOME_READ_TOOLS_PROVIDER);
		expect(definitions.map(({ name }) => name)).toEqual([SEARCH_HOME_TOOL_NAME, QUERY_HOME_STATE_TOOL_NAME]);
		for (const definition of definitions) {
			expect(definition.audiences).toEqual([ToolAudience.BUDDY]);
			expect(definition.access).toBe(ToolAccessKind.READ);
			expect(definition.parameters).not.toHaveProperty('properties.profile');
		}
		expect(stateDefinition.parameters).toMatchObject({
			type: 'object',
			properties: {
				operation: {
					type: 'string',
					enum: ['rows', 'any', 'all', 'count_matches'],
				},
			},
		});
		expect(stateDefinition.parameters).not.toHaveProperty('oneOf');

		const anthropicPayload = buildAnthropicRequestPayload(
			'claude-test',
			'system',
			[{ role: MessageRole.USER, content: 'Are any windows open?' }],
			1024,
			[stateDefinition],
		);
		expect(anthropicPayload).toMatchObject({
			tools: [
				{
					name: QUERY_HOME_STATE_TOOL_NAME,
					input_schema: { type: 'object' },
				},
			],
		});

		expect(searchHomeToolInputSchema.safeParse({ query: 'kitchen', profile: 'mcp-compatibility' }).success).toBe(false);
		expect(queryHomeStateToolInputSchema.safeParse({ operation: 'any' }).success).toBe(false);
		expect(
			queryHomeStateToolInputSchema.safeParse({
				operation: 'rows',
				limit: BUDDY_CURRENT_STATE_MAX_EVIDENCE_ROWS + 1,
			}).success,
		).toBe(false);
	});

	it('maps the complete search ABI to the fixed Buddy search profile and preserves bounded data', async () => {
		const result: HomeEntitySearchResponse = {
			query: 'kitchen light',
			entities: [],
			observed_at: observedAt,
			total: 42,
			returned: 0,
			totals_by_kind: { space: 1, device: 2, property: 39, scene: 0 },
			partial: false,
			truncated: true,
			refine_required: true,
			next_cursor: 'cursor-2',
		};
		searchEntities.mockResolvedValue(result);

		const execution = await provider.executeTool(
			{
				id: 'call-search',
				name: SEARCH_HOME_TOOL_NAME,
				arguments: {
					query: ' kitchen light ',
					kinds: ['property'],
					space_id: 'space-1',
					categories: ['light'],
					candidate_capability: 'read',
					limit: 7,
					cursor: 'cursor-1',
				},
			},
			{ audience: ToolAudience.BUDDY, allowedAccessKinds: [ToolAccessKind.READ] },
		);

		expect(searchEntities).toHaveBeenCalledWith({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'kitchen light',
			kinds: ['property'],
			spaceId: 'space-1',
			categories: ['light'],
			candidateCapability: 'read',
			limit: 7,
			cursor: 'cursor-1',
		});
		expect(execution).toEqual({
			success: true,
			status: ToolExecutionStatus.COMPLETED,
			message:
				'Returned 0 of 42 matching home entities. Refine the query to search beyond the bounded candidate window.',
			data: result,
		});
	});

	it('maps current-state filters to the fixed profile and reports partial aggregates without inventing a value', async () => {
		const result = partialAnyResult();
		queryCurrentState.mockResolvedValue(result);

		const execution = await provider.executeTool({
			id: 'call-state',
			name: QUERY_HOME_STATE_TOOL_NAME,
			arguments: {
				operation: 'any',
				space_id: 'space-1',
				channel_categories: [ChannelCategory.CONTACT],
				property_categories: [PropertyCategory.DETECTED],
				data_types: [DataTypeType.BOOL],
				predicate: { operator: 'eq', value: true },
				limit: 5,
			},
		});

		expect(queryCurrentState).toHaveBeenCalledWith({
			profile: HOME_CURRENT_STATE_PROFILE_BUDDY_V1,
			operation: 'any',
			spaceId: 'space-1',
			channelCategories: [ChannelCategory.CONTACT],
			propertyCategories: [PropertyCategory.DETECTED],
			dataTypes: [DataTypeType.BOOL],
			predicate: { operator: 'eq', value: true },
			limit: 5,
		});
		expect(execution).toEqual({
			success: true,
			status: ToolExecutionStatus.PARTIAL,
			message: 'Current-state any result is indeterminate; evaluated 1/2 eligible values.',
			data: result,
		});
	});

	it('returns a successful completed no-eligible aggregate without turning it into false', async () => {
		const result: HomeCurrentStateResult = {
			...emptyStateBase(),
			operation: 'count_matches',
			predicate: { operator: 'eq', value: true },
			value: null,
			definitive: false,
			status: 'no_eligible',
		};
		queryCurrentState.mockResolvedValue(result);

		const execution = await provider.executeTool({
			id: 'call-empty',
			name: QUERY_HOME_STATE_TOOL_NAME,
			arguments: { operation: 'count_matches', predicate: { operator: 'eq', value: true } },
		});

		expect(execution).toMatchObject({
			success: true,
			status: ToolExecutionStatus.COMPLETED,
			message: 'Current-state count_matches result is no_eligible; evaluated 0/0 eligible values.',
			data: result,
		});
	});

	it('sanitizes adapter arguments and expected shared errors', async () => {
		const invalid = await provider.executeTool({
			id: 'call-invalid',
			name: SEARCH_HOME_TOOL_NAME,
			arguments: { query: 'light', profile: HOME_SEARCH_PROFILE_BUDDY_V1 },
		});

		expect(searchEntities).not.toHaveBeenCalled();
		expect(invalid).toMatchObject({
			success: false,
			status: ToolExecutionStatus.FAILED,
			errorCode: 'INVALID_TOOL_ARGUMENTS',
		});

		searchEntities.mockRejectedValueOnce(new HomeSearchInvalidCursorError('query_mismatch'));
		const cursor = await provider.executeTool({
			id: 'call-cursor',
			name: SEARCH_HOME_TOOL_NAME,
			arguments: { query: 'light', cursor: 'stale' },
		});
		expect(cursor).toEqual({
			success: false,
			status: ToolExecutionStatus.FAILED,
			message: 'The search cursor is invalid for these filters.',
			errorCode: 'HOME_SEARCH_INVALID_CURSOR',
		});

		queryCurrentState.mockRejectedValueOnce(new HomeContextSpaceNotFoundError('private-space-id'));
		const missing = await provider.executeTool({
			id: 'call-space',
			name: QUERY_HOME_STATE_TOOL_NAME,
			arguments: { operation: 'rows', space_id: 'private-space-id' },
		});
		expect(missing).toEqual({
			success: false,
			status: ToolExecutionStatus.FAILED,
			message: 'The requested space was not found.',
			errorCode: 'HOME_SPACE_NOT_FOUND',
		});
	});

	it('is excluded from MCP listing and execution by the real registry', async () => {
		const registry = new ToolProviderRegistryService();
		registry.register(provider);
		searchEntities.mockResolvedValue({
			query: 'light',
			entities: [],
			observed_at: observedAt,
			total: 0,
			returned: 0,
			totals_by_kind: { space: 0, device: 0, property: 0, scene: 0 },
			partial: false,
			truncated: false,
			refine_required: false,
		});

		expect(registry.getAllToolDefinitions({ audience: ToolAudience.MCP })).toEqual([]);
		const denied = await registry.executeTool(
			{ id: 'mcp-call', name: SEARCH_HOME_TOOL_NAME, arguments: { query: 'light' } },
			{ audience: ToolAudience.MCP, source: ToolAudience.MCP },
		);

		expect(denied).toEqual({
			success: false,
			status: ToolExecutionStatus.DENIED,
			message: `Tool "${SEARCH_HOME_TOOL_NAME}" is not available to mcp`,
			errorCode: 'TOOL_AUDIENCE_DENIED',
		});
		expect(searchEntities).not.toHaveBeenCalled();
	});

	it('uses the registry transport bound without echoing pathological home labels in the message', async () => {
		const registry = new ToolProviderRegistryService();
		const pathologicalName = 'x'.repeat(33 * 1024);
		registry.register(provider);
		searchEntities.mockResolvedValue({
			query: 'room',
			entities: [
				{
					kind: 'space',
					id: 'space-1',
					name: pathologicalName,
					score: 900,
					reasons: ['exact_name'],
					candidate_capabilities: [],
					type: 'room',
					category: null,
					parent_id: null,
				},
			],
			observed_at: observedAt,
			total: 1,
			returned: 1,
			totals_by_kind: { space: 1, device: 0, property: 0, scene: 0 },
			partial: false,
			truncated: false,
			refine_required: false,
		});

		const execution = await registry.executeTool({
			id: 'bounded-call',
			name: SEARCH_HOME_TOOL_NAME,
			arguments: { query: 'room' },
		});

		expect(execution.success).toBe(true);
		expect(execution.message).toBe('Returned 1 of 1 matching home entities.');
		expect(execution.message).not.toContain(pathologicalName);
		expect(execution.data).toBeUndefined();
		expect(execution.truncated).toBe(true);
	});

	function emptyStateBase(): Omit<HomeCurrentStateResult, 'operation'> {
		return {
			profile: HOME_CURRENT_STATE_PROFILE_BUDDY_V1,
			predicate: null,
			space_id: null,
			rows: [],
			observed_at: observedAt,
			eligible: 0,
			scanned: 0,
			evaluated: 0,
			unknown: 0,
			matched: 0,
			returned: 0,
			complete: true,
			partial: false,
			partial_reasons: [],
			truncated: false,
			storage_status: 'not_needed',
			cache_count: 0,
			storage_count: 0,
			missing_count: 0,
			unprocessed_count: 0,
			oldest_last_updated: null,
			newest_last_updated: null,
			freshness_unknown_count: 0,
		};
	}

	function partialAnyResult(): HomeCurrentStateResult {
		return {
			profile: HOME_CURRENT_STATE_PROFILE_BUDDY_V1,
			operation: 'any',
			predicate: { operator: 'eq', value: true },
			space_id: 'space-1',
			rows: [],
			observed_at: observedAt,
			eligible: 2,
			scanned: 2,
			evaluated: 1,
			unknown: 1,
			matched: 0,
			returned: 0,
			complete: false,
			partial: true,
			partial_reasons: ['missing_values'],
			truncated: false,
			storage_status: 'disconnected',
			cache_count: 1,
			storage_count: 0,
			missing_count: 1,
			unprocessed_count: 0,
			oldest_last_updated: observedAt,
			newest_last_updated: observedAt,
			freshness_unknown_count: 0,
			value: null,
			definitive: false,
			status: 'indeterminate',
		};
	}
});
