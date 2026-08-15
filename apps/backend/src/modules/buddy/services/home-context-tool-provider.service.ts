import { z } from 'zod';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, DataTypeType, PropertyCategory } from '../../devices/devices.constants';
import {
	HOME_CURRENT_STATE_EQUALITY_OPERATORS,
	HOME_CURRENT_STATE_LIMIT_PROFILES,
	HOME_CURRENT_STATE_OPERATIONS,
	HOME_CURRENT_STATE_ORDERING_OPERATORS,
	HOME_CURRENT_STATE_PROFILE_BUDDY_V1,
	HOME_SEARCH_CANDIDATE_CAPABILITIES,
	HOME_SEARCH_ENTITY_KINDS,
	HOME_SEARCH_LIMIT_PROFILES,
	HOME_SEARCH_PROFILE_BUDDY_V1,
} from '../../home-context/home-context.constants';
import { HomeContextSpaceNotFoundError } from '../../home-context/home-context.errors';
import { HomeSearchInvalidCursorError, HomeSearchInvalidQueryError } from '../../home-context/home-search.errors';
import { HomeCurrentStateQuery } from '../../home-context/models/home-current-state-query.model';
import { homeCurrentStateResultSchema } from '../../home-context/schemas/home-current-state-output.schemas';
import { homeEntitySearchResponseSchema } from '../../home-context/schemas/home-search-output.schemas';
import { HomeCurrentStateQueryService } from '../../home-context/services/home-current-state-query.service';
import { HomeSearchQueryService } from '../../home-context/services/home-search-query.service';
import {
	LlmToolCall,
	ToolAccessKind,
	ToolAudience,
	ToolDefinition,
	ToolExecutionContext,
	ToolExecutionResult,
	ToolExecutionStatus,
	createToolDefinition,
} from '../../tools/platforms/tool-provider.platform';
import { BaseToolProviderService } from '../../tools/services/base-tool-provider.service';
import { BUDDY_MODULE_NAME } from '../buddy.constants';

export const BUDDY_HOME_READ_TOOLS_PROVIDER = 'buddy-home-read-tools';
export const SEARCH_HOME_TOOL_NAME = 'search_home';
export const QUERY_HOME_STATE_TOOL_NAME = 'query_home_state';
export const BUDDY_CURRENT_STATE_MAX_EVIDENCE_ROWS = 20;

const searchLimits = HOME_SEARCH_LIMIT_PROFILES[HOME_SEARCH_PROFILE_BUDDY_V1];
const stateLimits = HOME_CURRENT_STATE_LIMIT_PROFILES[HOME_CURRENT_STATE_PROFILE_BUDDY_V1];

export const searchHomeToolInputSchema = z
	.object({
		query: z.string().trim().min(1).max(searchLimits.maxQueryCharacters),
		kinds: z
			.array(z.enum(HOME_SEARCH_ENTITY_KINDS))
			.min(1)
			.max(searchLimits.maxKinds)
			.refine((kinds) => new Set(kinds).size === kinds.length, 'Search kinds must be unique')
			.optional(),
		space_id: z.string().trim().min(1).max(128).optional(),
		categories: z
			.array(z.string().trim().min(1).max(64))
			.min(1)
			.max(searchLimits.maxCategories)
			.refine((categories) => new Set(categories).size === categories.length, 'Search categories must be unique')
			.optional(),
		candidate_capability: z.enum(HOME_SEARCH_CANDIDATE_CAPABILITIES).optional(),
		limit: z.number().int().min(1).max(searchLimits.maxResults).optional(),
		cursor: z.string().min(1).max(searchLimits.maxCursorCharacters).optional(),
	})
	.strict();

const uniqueArray = <T extends z.ZodType>(schema: T, max: number, label: string) =>
	z
		.array(schema)
		.min(1)
		.max(max)
		.refine((values) => new Set(values).size === values.length, `${label} must be unique`)
		.optional();

const statePredicateSchema = z.union([
	z
		.object({
			operator: z.enum(HOME_CURRENT_STATE_EQUALITY_OPERATORS),
			value: z.union([z.string().max(stateLimits.maxPredicateStringCharacters), z.boolean()]),
		})
		.strict(),
	z
		.object({
			operator: z.enum(HOME_CURRENT_STATE_EQUALITY_OPERATORS),
			value: z.number().finite(),
			unit: z.string().trim().min(1).max(32),
		})
		.strict(),
	z
		.object({
			operator: z.enum(HOME_CURRENT_STATE_ORDERING_OPERATORS),
			value: z.number().finite(),
			unit: z.string().trim().min(1).max(32),
		})
		.strict(),
]);

const stateInputShape = {
	space_id: z.string().trim().min(1).max(128).optional(),
	channel_categories: uniqueArray(z.enum(ChannelCategory), stateLimits.maxChannelCategories, 'Channel categories'),
	property_categories: uniqueArray(z.enum(PropertyCategory), stateLimits.maxPropertyCategories, 'Property categories'),
	data_types: uniqueArray(z.enum(DataTypeType), stateLimits.maxDataTypes, 'Data types'),
	limit: z.number().int().min(1).max(BUDDY_CURRENT_STATE_MAX_EVIDENCE_ROWS).optional(),
};

export const queryHomeStateToolInputSchema = z
	.object({
		...stateInputShape,
		operation: z.enum(HOME_CURRENT_STATE_OPERATIONS),
		predicate: statePredicateSchema.optional(),
	})
	.strict()
	.superRefine((input, context) => {
		if (input.operation !== 'rows' && input.predicate === undefined) {
			context.addIssue({
				code: 'custom',
				path: ['predicate'],
				message: `A predicate is required for the ${input.operation} operation`,
			});
		}
	});

@Injectable()
export class HomeContextToolProviderService extends BaseToolProviderService {
	protected readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'HomeContextToolProviderService');

	constructor(
		private readonly homeSearch: HomeSearchQueryService,
		private readonly currentState: HomeCurrentStateQueryService,
	) {
		super();
	}

	getType(): string {
		return BUDDY_HOME_READ_TOOLS_PROVIDER;
	}

	getToolDefinitions(): ToolDefinition[] {
		return [
			createToolDefinition({
				name: SEARCH_HOME_TOOL_NAME,
				description:
					'Search bounded home catalog metadata for spaces, devices, properties, and scenes. ' +
					'Use this to discover canonical IDs for focused reads. IDs and candidate capabilities are metadata hints only, ' +
					'not action authorization or proof that an action can execute. Refine the query when refine_required is true.',
				audiences: [ToolAudience.BUDDY],
				access: ToolAccessKind.READ,
				inputSchema: searchHomeToolInputSchema,
				outputSchema: homeEntitySearchResponseSchema,
			}),
			createToolDefinition({
				name: QUERY_HOME_STATE_TOOL_NAME,
				description:
					'Read a bounded set of current property values or evaluate completeness-safe any, all, and count_matches predicates. ' +
					'Never treat an indeterminate or partial result as a complete negative or exact count. Numeric predicates require an explicit unit.',
				audiences: [ToolAudience.BUDDY],
				access: ToolAccessKind.READ,
				inputSchema: queryHomeStateToolInputSchema,
				outputSchema: homeCurrentStateResultSchema,
			}),
		];
	}

	protected async handleToolCall(
		toolCall: LlmToolCall,
		_context: ToolExecutionContext,
	): Promise<ToolExecutionResult | null> {
		if (toolCall.name === SEARCH_HOME_TOOL_NAME) {
			return this.searchHome(toolCall.arguments);
		}

		if (toolCall.name === QUERY_HOME_STATE_TOOL_NAME) {
			return this.queryHomeState(toolCall.arguments);
		}

		return null;
	}

	private async searchHome(argumentsValue: Record<string, unknown>): Promise<ToolExecutionResult> {
		const parsed = searchHomeToolInputSchema.safeParse(argumentsValue);

		if (!parsed.success) {
			return this.invalidArguments(SEARCH_HOME_TOOL_NAME);
		}

		try {
			const result = await this.homeSearch.searchEntities({
				profile: HOME_SEARCH_PROFILE_BUDDY_V1,
				query: parsed.data.query,
				kinds: parsed.data.kinds,
				spaceId: parsed.data.space_id,
				categories: parsed.data.categories,
				candidateCapability: parsed.data.candidate_capability,
				limit: parsed.data.limit,
				cursor: parsed.data.cursor,
			});
			const refinement = result.refine_required
				? ' Refine the query to search beyond the bounded candidate window.'
				: '';

			return {
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				message: `Returned ${result.returned} of ${result.total} matching home entities.${refinement}`,
				data: result as unknown as Record<string, unknown>,
			};
		} catch (error) {
			return this.mapExpectedError(error);
		}
	}

	private async queryHomeState(argumentsValue: Record<string, unknown>): Promise<ToolExecutionResult> {
		const parsed = queryHomeStateToolInputSchema.safeParse(argumentsValue);

		if (!parsed.success) {
			return this.invalidArguments(QUERY_HOME_STATE_TOOL_NAME);
		}

		try {
			const query = {
				profile: HOME_CURRENT_STATE_PROFILE_BUDDY_V1,
				operation: parsed.data.operation,
				spaceId: parsed.data.space_id,
				channelCategories: parsed.data.channel_categories,
				propertyCategories: parsed.data.property_categories,
				dataTypes: parsed.data.data_types,
				limit: parsed.data.limit,
				...(parsed.data.predicate === undefined ? {} : { predicate: parsed.data.predicate }),
			} as HomeCurrentStateQuery;
			const result = await this.currentState.queryCurrentState(query);
			const coverage = `${result.evaluated}/${result.eligible} eligible values`;
			const message =
				result.operation === 'rows'
					? `Evaluated ${coverage} and returned ${result.returned} bounded evidence rows${result.partial ? ' with partial coverage' : ''}.`
					: `Current-state ${result.operation} result is ${result.status}; evaluated ${coverage}.`;

			return {
				success: true,
				status: result.partial ? ToolExecutionStatus.PARTIAL : ToolExecutionStatus.COMPLETED,
				message,
				data: result as unknown as Record<string, unknown>,
			};
		} catch (error) {
			return this.mapExpectedError(error);
		}
	}

	private invalidArguments(toolName: string): ToolExecutionResult {
		return {
			success: false,
			status: ToolExecutionStatus.FAILED,
			message: `Invalid arguments for tool "${toolName}"`,
			errorCode: 'INVALID_TOOL_ARGUMENTS',
		};
	}

	private mapExpectedError(error: unknown): ToolExecutionResult {
		if (error instanceof HomeContextSpaceNotFoundError) {
			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: 'The requested space was not found.',
				errorCode: 'HOME_SPACE_NOT_FOUND',
			};
		}

		if (error instanceof HomeSearchInvalidCursorError) {
			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: 'The search cursor is invalid for these filters.',
				errorCode: 'HOME_SEARCH_INVALID_CURSOR',
			};
		}

		if (error instanceof HomeSearchInvalidQueryError) {
			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: 'The home search query is invalid.',
				errorCode: 'HOME_SEARCH_INVALID_QUERY',
			};
		}

		throw error;
	}
}
