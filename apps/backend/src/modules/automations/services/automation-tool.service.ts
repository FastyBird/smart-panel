import { z } from 'zod';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { SpacesService } from '../../spaces/services/spaces.service';
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
import { ScopedShortIdTargetKind, ShortIdMappingService } from '../../tools/services/short-id-mapping.service';
import { AUTOMATIONS_MODULE_NAME, AutomationRunStatus, AutomationStatus } from '../automations.constants';
import {
	AutomationsGraphValidationException,
	AutomationsNotFoundException,
	AutomationsNotTriggerableException,
	AutomationsRevisionConflictException,
} from '../automations.exceptions';
import { AutomationEntity } from '../entities/automations.entity';

import { AutomationEngineService } from './automation-engine.service';
import { AutomationsService } from './automations.service';

export const AUTOMATION_TOOLS_PROVIDER = 'automation-tools';
export const LIST_AUTOMATIONS_TOOL_NAME = 'list_automations';
export const RUN_AUTOMATION_TOOL_NAME = 'run_automation';
export const SET_AUTOMATION_ENABLED_TOOL_NAME = 'set_automation_enabled';

/** How many automations one list call returns at most */
export const AUTOMATION_TOOL_LIST_LIMIT = 50;

const BUDDY_TARGET_NOT_EXPOSED_MESSAGE = 'The requested target is not available in this Buddy conversation.';
const BUDDY_TARGET_NOT_EXPOSED_ERROR_CODE = 'BUDDY_TARGET_NOT_EXPOSED';

/** Engine refusal codes of a manual run, mapped to the tool error codes */
const RUN_REFUSAL_ERROR_CODES: Record<string, string> = {
	not_found: 'AUTOMATION_NOT_LOADED',
	disabled: 'AUTOMATION_DISABLED',
	invalid: 'AUTOMATION_INVALID',
	suspended: 'AUTOMATION_SUSPENDED',
	not_a_trigger: 'AUTOMATION_NO_TRIGGER',
	no_trigger: 'AUTOMATION_NO_TRIGGER',
	not_running: 'AUTOMATION_ENGINE_NOT_RUNNING',
};

/** Outcomes of a handled manual run that did not start one, mapped to the tool error codes */
const RUN_SKIPPED_ERROR_CODES: Record<'ignored' | 'dropped' | 'suspended', string> = {
	ignored: 'AUTOMATION_RUN_IGNORED',
	dropped: 'AUTOMATION_RUN_DROPPED',
	suspended: 'AUTOMATION_SUSPENDED',
};

const automationReferenceSchema = z
	.string()
	.trim()
	.min(1)
	.max(128)
	.describe('Automation ID returned by list_automations (the automation_id value)');

const LIST_AUTOMATIONS_INPUT_SCHEMA = z
	.object({
		space_id: z
			.string()
			.trim()
			.min(1)
			.max(128)
			.optional()
			.describe('Only automations assigned to this space (room or zone); omit for the whole home'),
		enabled: z.boolean().optional().describe('Only enabled (true) or only disabled (false) automations'),
	})
	.strict();

const RUN_AUTOMATION_INPUT_SCHEMA = z.object({
	automation_id: automationReferenceSchema,
});

const SET_AUTOMATION_ENABLED_INPUT_SCHEMA = z.object({
	automation_id: automationReferenceSchema,
	enabled: z.boolean().describe('true switches the automation on, false switches it off'),
});

const automationStatusSchema = z.enum(AutomationStatus);

const LIST_AUTOMATIONS_OUTPUT_SCHEMA = z.object({
	automations: z
		.array(
			z.object({
				automation_id: z.string(),
				name: z.string(),
				description: z.string().nullable(),
				space_id: z.string().nullable(),
				enabled: z.boolean(),
				status: automationStatusSchema,
				last_triggered_at: z.string().nullable(),
				last_run_status: z.enum(AutomationRunStatus).nullable(),
			}),
		)
		.max(AUTOMATION_TOOL_LIST_LIMIT),
	total: z.number().int().nonnegative(),
	truncated: z.boolean(),
});

const RUN_AUTOMATION_OUTPUT_SCHEMA = z.object({
	automation_id: z.string(),
	started: z.boolean(),
	outcome: z.enum(['started', 'ignored', 'dropped', 'suspended', 'refused']),
	run_id: z.string().nullable(),
	reason: z.string().nullable(),
});

const SET_AUTOMATION_ENABLED_OUTPUT_SCHEMA = z.object({
	automation_id: z.string(),
	enabled: z.boolean(),
	changed: z.boolean(),
	automation_status: automationStatusSchema,
});

type ResolvedAutomation = { automation: AutomationEntity; reference: string } | { result: ToolExecutionResult };

/**
 * Tool provider that lets Buddy and MCP clients list automations, run one and switch one on or off.
 *
 * It never offers a tool that creates, edits or deletes an automation or exposes its graph: the graph is drawn
 * in the admin only. A run goes through the manual-run path of the engine, so the run mode, the overload guard
 * and the safety policy apply as they do to the REST endpoint; switching on goes through
 * `AutomationsService.setEnabled`, which validates the graph.
 */
@Injectable()
export class AutomationToolService extends BaseToolProviderService {
	protected readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationToolService');

	constructor(
		private readonly automationsService: AutomationsService,
		private readonly engine: AutomationEngineService,
		private readonly spacesService: SpacesService,
		private readonly shortIdMapping: ShortIdMappingService,
	) {
		super();
	}

	getType(): string {
		return AUTOMATION_TOOLS_PROVIDER;
	}

	getToolDefinitions(): ToolDefinition[] {
		return [
			createToolDefinition({
				name: LIST_AUTOMATIONS_TOOL_NAME,
				description:
					'List the automations of the home: their name, space, whether they are enabled, their status and how ' +
					'their last run ended. Automations react to triggers on their own; they are not scenes. ' +
					'Use the returned automation_id with run_automation or set_automation_enabled.',
				audiences: [ToolAudience.BUDDY, ToolAudience.MCP],
				access: ToolAccessKind.READ,
				inputSchema: LIST_AUTOMATIONS_INPUT_SCHEMA,
				outputSchema: LIST_AUTOMATIONS_OUTPUT_SCHEMA,
			}),
			createToolDefinition({
				name: RUN_AUTOMATION_TOOL_NAME,
				description:
					'Run an enabled automation now, as if one of its triggers fired. The run is started and not waited ' +
					'for. A disabled, invalid or suspended automation is not run.',
				audiences: [ToolAudience.BUDDY, ToolAudience.MCP],
				access: ToolAccessKind.TRIGGER,
				inputSchema: RUN_AUTOMATION_INPUT_SCHEMA,
				outputSchema: RUN_AUTOMATION_OUTPUT_SCHEMA,
			}),
			createToolDefinition({
				name: SET_AUTOMATION_ENABLED_TOOL_NAME,
				description:
					'Switch an automation on or off. Nothing else of the automation is changed. An automation whose ' +
					'graph is incomplete cannot be switched on.',
				audiences: [ToolAudience.BUDDY, ToolAudience.MCP],
				access: ToolAccessKind.WRITE,
				inputSchema: SET_AUTOMATION_ENABLED_INPUT_SCHEMA,
				outputSchema: SET_AUTOMATION_ENABLED_OUTPUT_SCHEMA,
			}),
		];
	}

	protected async handleToolCall(
		toolCall: LlmToolCall,
		context: ToolExecutionContext,
	): Promise<ToolExecutionResult | null> {
		switch (toolCall.name) {
			case LIST_AUTOMATIONS_TOOL_NAME:
				return this.listAutomations(toolCall, context);
			case RUN_AUTOMATION_TOOL_NAME:
				return this.runAutomation(toolCall, context);
			case SET_AUTOMATION_ENABLED_TOOL_NAME:
				return this.setAutomationEnabled(toolCall, context);
			default:
				return null;
		}
	}

	private async listAutomations(toolCall: LlmToolCall, context: ToolExecutionContext): Promise<ToolExecutionResult> {
		const parsed = LIST_AUTOMATIONS_INPUT_SCHEMA.safeParse(toolCall.arguments ?? {});

		if (!parsed.success) {
			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: 'Invalid parameters: space_id must be a space ID and enabled a boolean',
				errorCode: 'INVALID_TOOL_ARGUMENTS',
			};
		}

		let spaceIds: string[] | undefined;

		if (parsed.data.space_id !== undefined) {
			const spaceId = this.resolveSpaceId(parsed.data.space_id, context);
			const space = await this.spacesService.findOne(spaceId);

			if (!space) {
				return {
					success: false,
					status: ToolExecutionStatus.FAILED,
					message: `Space with ID "${parsed.data.space_id}" not found`,
					errorCode: 'SPACE_NOT_FOUND',
				};
			}

			// The same scope as the scenes of the home context: a floor covers its rooms, the master space the home
			const scope = await this.spacesService.resolveSnapshotScope(space);

			spaceIds = scope.wholeHome ? undefined : (scope.sceneSpaceIds ?? []);
		}

		const page = await this.automationsService.findSummaryPage(AUTOMATION_TOOL_LIST_LIMIT, {
			spaceIds,
			enabled: parsed.data.enabled,
		});
		const automations: z.infer<typeof LIST_AUTOMATIONS_OUTPUT_SCHEMA>['automations'] = [];
		let unexposed = false;

		for (const automation of page.automations) {
			const reference = this.exposeAutomation(automation.id, context);

			if (reference === null) {
				unexposed = true;

				continue;
			}

			automations.push({
				automation_id: reference,
				name: automation.name,
				description: automation.description ?? null,
				space_id: this.exposeSpace(automation.spaceId, context),
				enabled: automation.enabled,
				status: automation.status,
				last_triggered_at: this.toIsoString(automation.lastTriggeredAt),
				last_run_status: automation.lastRunStatus ?? null,
			});
		}

		const truncated = unexposed || page.total > page.automations.length;
		const listing = automations
			.map(
				(automation) =>
					`${automation.name} [id=${automation.automation_id}] (${automation.enabled ? 'enabled' : 'disabled'}, ${automation.status})`,
			)
			.join('; ');

		return {
			success: true,
			status: ToolExecutionStatus.COMPLETED,
			message:
				automations.length === 0
					? 'No automation matches.'
					: `Found ${page.total} automation(s)${truncated ? `, showing ${automations.length}` : ''}: ${listing}`,
			data: { automations, total: page.total, truncated },
		};
	}

	private async runAutomation(toolCall: LlmToolCall, context: ToolExecutionContext): Promise<ToolExecutionResult> {
		const parsed = RUN_AUTOMATION_INPUT_SCHEMA.safeParse(toolCall.arguments);

		if (!parsed.success) {
			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: 'Missing or invalid required parameter: automation_id',
				errorCode: 'INVALID_TOOL_ARGUMENTS',
			};
		}

		const resolved = await this.resolveAutomation(parsed.data.automation_id, context);

		if ('result' in resolved) {
			return resolved.result;
		}

		const { automation, reference } = resolved;

		this.logger.log(
			`[RUN] Manual run of automation id=${automation.id} requested (source=${context.source}, audience=${context.audience}, actor=${context.actorId ?? 'none'}, request=${context.requestId ?? 'none'})`,
		);

		try {
			const outcome = await this.engine.triggerOrThrow(automation.id);

			if (outcome.outcome === 'started') {
				return {
					success: true,
					status: ToolExecutionStatus.COMPLETED,
					message: `Automation "${automation.name}" was started`,
					data: {
						automation_id: reference,
						started: true,
						outcome: 'started',
						run_id: outcome.runId,
						reason: null,
					},
				};
			}

			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: `Automation "${automation.name}" was not started: ${outcome.reason}`,
				data: {
					automation_id: reference,
					started: false,
					outcome: outcome.outcome,
					run_id: null,
					reason: outcome.reason,
				},
				errorCode: RUN_SKIPPED_ERROR_CODES[outcome.outcome],
			};
		} catch (error) {
			if (error instanceof AutomationsNotFoundException) {
				return this.notFound(parsed.data.automation_id);
			}

			if (error instanceof AutomationsNotTriggerableException) {
				return {
					success: false,
					status: ToolExecutionStatus.DENIED,
					message: `Automation "${automation.name}" cannot be run: ${error.message}`,
					data: {
						automation_id: reference,
						started: false,
						outcome: 'refused',
						run_id: null,
						reason: error.message,
					},
					errorCode: RUN_REFUSAL_ERROR_CODES[error.code] ?? 'AUTOMATION_RUN_REFUSED',
				};
			}

			throw error;
		}
	}

	private async setAutomationEnabled(
		toolCall: LlmToolCall,
		context: ToolExecutionContext,
	): Promise<ToolExecutionResult> {
		const parsed = SET_AUTOMATION_ENABLED_INPUT_SCHEMA.safeParse(toolCall.arguments);

		if (!parsed.success) {
			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: 'Missing or invalid required parameters: automation_id, enabled',
				errorCode: 'INVALID_TOOL_ARGUMENTS',
			};
		}

		const resolved = await this.resolveAutomation(parsed.data.automation_id, context);

		if ('result' in resolved) {
			return resolved.result;
		}

		const { automation: existing, reference } = resolved;
		const enabled = parsed.data.enabled;
		const verb = enabled ? 'enabled' : 'disabled';

		this.logger.log(
			`[SET ENABLED] Automation id=${existing.id} to be ${verb} (source=${context.source}, audience=${context.audience}, actor=${context.actorId ?? 'none'}, request=${context.requestId ?? 'none'})`,
		);

		try {
			const automation = await this.automationsService.setEnabled(existing.id, enabled);
			const changed = existing.enabled !== automation.enabled;

			return {
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				message: changed
					? `Automation "${automation.name}" was ${verb}`
					: `Automation "${automation.name}" is already ${verb}`,
				data: {
					automation_id: reference,
					enabled: automation.enabled,
					changed,
					automation_status: automation.status,
				},
			};
		} catch (error) {
			if (error instanceof AutomationsNotFoundException) {
				return this.notFound(parsed.data.automation_id);
			}

			if (error instanceof AutomationsGraphValidationException) {
				// The issues can quote node identifiers and configuration; they stay in the admin
				return {
					success: false,
					status: ToolExecutionStatus.FAILED,
					message: `Automation "${existing.name}" cannot be enabled: its graph is incomplete or invalid. Fix it in the admin first.`,
					errorCode: 'AUTOMATION_GRAPH_INVALID',
				};
			}

			if (error instanceof AutomationsRevisionConflictException) {
				return {
					success: false,
					status: ToolExecutionStatus.FAILED,
					message: `Automation "${existing.name}" is being changed by somebody else. Try again later.`,
					errorCode: 'AUTOMATION_CONFLICT',
				};
			}

			throw error;
		}
	}

	/**
	 * Resolves the reference the caller passed to a stored automation. Buddy may only name an automation it was
	 * shown in this conversation; an MCP client names it by its ID.
	 */
	private async resolveAutomation(reference: string, context: ToolExecutionContext): Promise<ResolvedAutomation> {
		const id =
			context.audience === ToolAudience.BUDDY
				? context.conversationId
					? this.shortIdMapping.resolveScoped(context.conversationId, reference, ScopedShortIdTargetKind.AUTOMATION)
					: null
				: (this.shortIdMapping.resolve(reference) ?? reference);

		if (id === null) {
			return {
				result: {
					success: false,
					status: ToolExecutionStatus.DENIED,
					message: BUDDY_TARGET_NOT_EXPOSED_MESSAGE,
					errorCode: BUDDY_TARGET_NOT_EXPOSED_ERROR_CODE,
				},
			};
		}

		const automation = await this.automationsService.findOne(id);

		if (!automation) {
			return { result: this.notFound(reference) };
		}

		return { automation, reference: context.audience === ToolAudience.BUDDY ? reference : id };
	}

	private notFound(reference: string): ToolExecutionResult {
		return {
			success: false,
			status: ToolExecutionStatus.FAILED,
			message: `Automation with ID "${reference}" not found`,
			errorCode: 'AUTOMATION_NOT_FOUND',
		};
	}

	private exposeAutomation(id: string, context: ToolExecutionContext): string | null {
		if (context.audience !== ToolAudience.BUDDY) {
			return id;
		}

		return context.conversationId
			? this.shortIdMapping.exposeScoped(context.conversationId, id, ScopedShortIdTargetKind.AUTOMATION)
			: null;
	}

	private exposeSpace(spaceId: string | null, context: ToolExecutionContext): string | null {
		if (spaceId === null || context.audience !== ToolAudience.BUDDY) {
			return spaceId;
		}

		return context.conversationId
			? this.shortIdMapping.exposeScoped(context.conversationId, spaceId, ScopedShortIdTargetKind.SPACE)
			: null;
	}

	private resolveSpaceId(spaceId: string, context: ToolExecutionContext): string {
		if (context.audience !== ToolAudience.BUDDY || context.conversationId === undefined) {
			return spaceId;
		}

		return this.shortIdMapping.resolveScoped(context.conversationId, spaceId, ScopedShortIdTargetKind.SPACE) ?? spaceId;
	}

	private toIsoString(value: Date | string | null | undefined): string | null {
		if (!value) {
			return null;
		}

		return value instanceof Date ? value.toISOString() : value;
	}
}
