import { DataSource as OrmDataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { ToolAudience, ToolExecutionResult, ToolExecutionStatus } from '../../tools/platforms/tool-provider.platform';
import { ScopedShortIdTargetKind, ShortIdMappingService } from '../../tools/services/short-id-mapping.service';
import { ToolProviderRegistryService } from '../../tools/services/tool-provider-registry.service';
import {
	BUDDY_MODULE_NAME,
	DEFAULT_CONTEXT_WINDOW_TOKENS,
	DEFAULT_MAX_TOOL_ITERATIONS,
	EventType,
	MessageRole,
} from '../buddy.constants';
import { BuddyConversationNotFoundException, BuddyProviderErrorException } from '../buddy.exceptions';
import { BuddyConversationEntity } from '../entities/buddy-conversation.entity';
import { BuddyMessageEntity } from '../entities/buddy-message.entity';
import { BuddyConfigModel } from '../models/config.model';
import {
	BUDDY_TRUNCATED_TOOL_RESULT_MESSAGE,
	admitBuddyToolResponse,
	canReserveBuddyLegacyToolTranscript,
	canReserveBuddyToolResultGroup,
	fitBuddyToolResultGroup,
	fitsBuddyLegacyToolTranscript,
} from '../platforms/llm-conversation-bounds.utils';
import {
	LlmConversationItem,
	LlmConversationToolCall,
	LlmConversationToolResult,
	LlmResponse,
	LlmResponseMeta,
	LlmToolCall,
	LlmToolResultStatus,
	ToolDefinition,
} from '../platforms/llm-provider.platform';

import { BuddyContext, BuddyContextService } from './buddy-context.service';
import { BuddyPersonalityService } from './buddy-personality.service';
import { QUERY_HOME_STATE_TOOL_NAME, SEARCH_HOME_TOOL_NAME } from './home-context-tool-provider.service';
import { ChatMessage, LlmProviderService } from './llm-provider.service';

const MAX_HISTORY_MESSAGES = 20;

/**
 * Default token budget as a fraction of the model's context window.
 * When the system prompt exceeds this ratio, devices/properties are truncated.
 */
const PROMPT_TOKEN_BUDGET_RATIO = 0.8;

/**
 * Conservatively estimate the number of tokens in prompt text from its UTF-8 byte length.
 * Opaque action references have high entropy and must not be budgeted like ordinary English prose.
 */
function estimateTokens(text: string): number {
	return Math.ceil(Buffer.byteLength(text, 'utf8') / 3);
}

@Injectable()
export class BuddyConversationService {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'BuddyConversationService');

	constructor(
		@InjectRepository(BuddyConversationEntity)
		private readonly conversationRepository: Repository<BuddyConversationEntity>,
		@InjectRepository(BuddyMessageEntity)
		private readonly messageRepository: Repository<BuddyMessageEntity>,
		private readonly dataSource: OrmDataSource,
		private readonly llmProvider: LlmProviderService,
		private readonly contextService: BuddyContextService,
		private readonly personalityService: BuddyPersonalityService,
		private readonly toolProviderRegistry: ToolProviderRegistryService,
		private readonly eventEmitter: EventEmitter2,
		private readonly shortIdMapping: ShortIdMappingService,
		private readonly configService: ConfigService,
	) {}

	async findAll(spaceId?: string): Promise<BuddyConversationEntity[]> {
		return this.conversationRepository.find({
			where: spaceId ? { spaceId } : undefined,
			order: { updatedAt: 'DESC' },
		});
	}

	async findOne(id: string): Promise<BuddyConversationEntity | null> {
		return this.conversationRepository.findOne({ where: { id } });
	}

	async findOneOrThrow(id: string): Promise<BuddyConversationEntity> {
		const conversation = await this.findOne(id);

		if (!conversation) {
			throw new BuddyConversationNotFoundException(id);
		}

		return conversation;
	}

	async getMessages(conversationId: string): Promise<BuddyMessageEntity[]> {
		return this.messageRepository.find({
			where: { conversationId },
			order: { createdAt: 'ASC' },
		});
	}

	async findMessage(conversationId: string, messageId: string): Promise<BuddyMessageEntity | null> {
		return this.messageRepository.findOne({
			where: { id: messageId, conversationId },
		});
	}

	async create(title?: string | null, spaceId?: string | null): Promise<BuddyConversationEntity> {
		const conversation = this.conversationRepository.create({
			id: uuid(),
			title: title ?? null,
			spaceId: spaceId ?? null,
		});

		const saved = await this.conversationRepository.save(conversation);

		this.logger.debug(`Created conversation id=${saved.id}`);

		return saved;
	}

	async sendMessage(conversationId: string, content: string): Promise<BuddyMessageEntity> {
		const conversation = await this.findOneOrThrow(conversationId);

		// 1. Build system prompt with context and personality
		// Short ID mappings accumulate across requests — the same UUID always maps
		// to the same short ID, so concurrent requests from different bot adapters
		// won't interfere with each other.
		const context = await this.contextService.buildContext(conversation.spaceId ?? undefined);
		const systemPrompt = await this.buildSystemPrompt(context, conversation.id, conversation.spaceId ?? undefined);

		// 2. Load most recent conversation history and append the new user message
		const history = await this.messageRepository.find({
			where: { conversationId: conversation.id },
			order: { createdAt: 'DESC' },
			take: MAX_HISTORY_MESSAGES - 1,
		});

		history.reverse();

		const chatMessages: ChatMessage[] = history
			.filter((m) => m.role === (MessageRole.USER as string) || m.role === (MessageRole.ASSISTANT as string))
			.map((m) => ({
				role: m.role as MessageRole.USER | MessageRole.ASSISTANT,
				content: m.content,
			}));

		chatMessages.push({ role: MessageRole.USER, content });

		// 3. Call LLM provider with tool support if available
		const supportsTools = this.llmProvider.supportsTools();
		const supportsNativeToolResults = supportsTools && this.llmProvider.supportsNativeToolResults();
		const tools = supportsTools
			? this.toolProviderRegistry
					.getAllToolDefinitions({ audience: ToolAudience.BUDDY })
					.filter(
						(definition) =>
							supportsNativeToolResults ||
							(definition.name !== SEARCH_HOME_TOOL_NAME && definition.name !== QUERY_HOME_STATE_TOOL_NAME),
					)
			: undefined;
		const maxIterations = this.getMaxToolIterations();
		const llmResponse = await this.sendWithToolExecution(
			systemPrompt,
			chatMessages,
			conversation.id,
			tools,
			maxIterations,
		);

		// 4. Persist both user message and assistant response in a single transaction
		const { savedUser, savedAssistant } = await this.dataSource.transaction(async (manager) => {
			const userMsg = manager.create(BuddyMessageEntity, {
				id: uuid(),
				conversationId: conversation.id,
				role: MessageRole.USER,
				content,
			});

			const persistedUser = await manager.save(userMsg);

			const assistantMsg = manager.create(BuddyMessageEntity, {
				id: uuid(),
				conversationId: conversation.id,
				role: MessageRole.ASSISTANT,
				content: llmResponse.content,
				metadata: llmResponse.meta,
			});

			const persistedAssistant = await manager.save(assistantMsg);

			// Always touch updatedAt so conversations sort by last activity
			await manager.update(BuddyConversationEntity, conversation.id, { updatedAt: new Date() });

			// Set title from first message atomically — the WHERE clause prevents
			// concurrent requests from overwriting each other's title.
			if (!conversation.title) {
				const proposedTitle = content.length > 50 ? content.substring(0, 47) + '...' : content;

				await manager
					.createQueryBuilder()
					.update(BuddyConversationEntity)
					.set({ title: proposedTitle })
					.where('id = :id AND title IS NULL', { id: conversation.id })
					.execute();
			}

			return { savedUser: persistedUser, savedAssistant: persistedAssistant };
		});

		// 5. Emit WebSocket events for both messages
		this.eventEmitter.emit(EventType.CONVERSATION_MESSAGE_RECEIVED, {
			conversation_id: conversation.id,
			message_id: savedUser.id,
			role: MessageRole.USER,
			content,
		});

		this.eventEmitter.emit(EventType.CONVERSATION_MESSAGE_RECEIVED, {
			conversation_id: conversation.id,
			message_id: savedAssistant.id,
			role: MessageRole.ASSISTANT,
			content: llmResponse.content,
		});

		this.logger.debug(`Message sent in conversation id=${conversation.id}, response id=${savedAssistant.id}`);

		return savedAssistant;
	}

	async remove(id: string): Promise<void> {
		const conversation = await this.findOneOrThrow(id);

		// Fail closed at deletion admission: a partial database deletion must not
		// leave action references for a conversation the user asked to remove.
		this.shortIdMapping.clearScope(conversation.id);

		// Delete messages first (cascade)
		await this.messageRepository.delete({ conversationId: conversation.id });
		await this.conversationRepository.delete(conversation.id);

		this.logger.debug(`Deleted conversation id=${id}`);
	}

	/**
	 * Send a message to the LLM with tool execution loop.
	 * If the LLM returns tool calls, execute them and feed results back.
	 * Repeats until the LLM produces a text response or max iterations reached.
	 */
	private async sendWithToolExecution(
		systemPrompt: string,
		messages: LlmConversationItem[],
		conversationId: string,
		tools?: ToolDefinition[],
		maxIterations: number = DEFAULT_MAX_TOOL_ITERATIONS,
	): Promise<LlmResponse> {
		// Work on a shallow copy so we never mutate the caller's array
		const workingMessages: LlmConversationItem[] = [...messages];
		const activeTurnId = uuid();
		let activeToolItems = 0;
		let activeToolTranscriptBytes = 0;
		let hasAttemptedToolExecution = false;

		let response = await this.llmProvider.sendMessage(systemPrompt, workingMessages, { tools });
		const activeProviderType = response.meta.provider;
		const useNativeToolResults = this.llmProvider.supportsNativeToolResults(activeProviderType);

		const hasToolWork = (r: typeof response): boolean =>
			(r.toolCalls !== undefined && r.toolCalls.length > 0) || (r.toolErrors !== undefined && r.toolErrors.length > 0);

		// If no tool calls or errors, return directly
		if (!hasToolWork(response)) {
			return this.clearActiveToolState(response);
		}

		// Accumulate token usage and duration across all LLM calls
		const accumulatedMeta = { ...response.meta };

		// Tool execution loop
		for (let iteration = 0; iteration < maxIterations; iteration++) {
			if (!hasToolWork(response)) {
				break;
			}

			const hasContentWithTools = !!response.content;

			const callCount = response.toolCalls?.length ?? 0;
			const errorCount = response.toolErrors?.length ?? 0;
			const admission = admitBuddyToolResponse(response, activeToolItems);

			if (!admission.accepted) {
				return this.toolLimitResponse(response, accumulatedMeta, hasAttemptedToolExecution);
			}

			activeToolItems += admission.itemCount;

			this.logger.debug(`Tool iteration ${iteration + 1}: ${callCount} tool call(s), ${errorCount} parse error(s)`);

			const toolCalls = response.toolCalls ?? [];
			const canonicalCallIds = toolCalls.map(
				(_toolCall, callIndex) => `buddy:${activeTurnId}:${iteration + 1}:${callIndex + 1}`,
			);

			if (useNativeToolResults && callCount > 0) {
				this.assertNativeProviderCallIds(toolCalls);
			}

			if (useNativeToolResults && errorCount === 0) {
				const canonicalCalls: LlmConversationToolCall[] = toolCalls.map((toolCall, callIndex) => ({
					callId: canonicalCallIds[callIndex],
					providerCallId: toolCall.id,
					name: toolCall.name,
					arguments: toolCall.arguments,
				}));
				const callItem = {
					type: 'assistant_tool_calls' as const,
					content: response.content,
					calls: canonicalCalls,
					...(response.providerItems === undefined ? {} : { providerItems: response.providerItems }),
				};

				if (!canReserveBuddyToolResultGroup(callItem, activeToolTranscriptBytes)) {
					return this.toolLimitResponse(response, accumulatedMeta, hasAttemptedToolExecution);
				}

				const canonicalResults: LlmConversationToolResult[] = [];
				let hasIndeterminateExecution = false;

				for (const [callIndex, toolCall] of toolCalls.entries()) {
					const canonicalCall = canonicalCalls[callIndex];
					let result: ToolExecutionResult;

					hasAttemptedToolExecution = true;

					try {
						result = await this.toolProviderRegistry.executeTool(toolCall, {
							audience: ToolAudience.BUDDY,
							source: ToolAudience.BUDDY,
							conversationId,
							requestId: canonicalCall.callId,
						});
					} catch {
						hasIndeterminateExecution = true;
						canonicalResults.push({
							callId: canonicalCall.callId,
							providerCallId: canonicalCall.providerCallId,
							toolName: canonicalCall.name,
							status: 'indeterminate',
							message: `Tool "${canonicalCall.name}" execution outcome is uncertain`,
							errorCode: 'TOOL_EXECUTION_INDETERMINATE',
							truncated: false,
						});

						for (const skippedCall of canonicalCalls.slice(callIndex + 1)) {
							canonicalResults.push({
								callId: skippedCall.callId,
								providerCallId: skippedCall.providerCallId,
								toolName: skippedCall.name,
								status: 'denied',
								message: `Tool "${skippedCall.name}" was not executed after an uncertain earlier outcome`,
								errorCode: 'TOOL_BATCH_ABORTED_AFTER_INDETERMINATE',
								truncated: false,
							});
						}

						break;
					}

					canonicalResults.push({
						callId: canonicalCall.callId,
						providerCallId: canonicalCall.providerCallId,
						toolName: canonicalCall.name,
						status: this.toLlmToolResultStatus(result.status),
						message: result.message,
						...(result.data === undefined ? {} : { data: result.data }),
						...(result.errorCode === undefined ? {} : { errorCode: result.errorCode }),
						truncated: result.truncated ?? false,
					});
				}

				const boundedResultGroup = fitBuddyToolResultGroup(callItem, canonicalResults, activeToolTranscriptBytes);

				if (boundedResultGroup === null) {
					return this.toolLimitResponse(response, accumulatedMeta, true);
				}

				activeToolTranscriptBytes = boundedResultGroup.nextActiveTranscriptBytes;
				workingMessages.push(callItem, boundedResultGroup.item);

				if (hasIndeterminateExecution) {
					const uncertaintyMessage =
						'I could not confirm whether the requested operation completed, so I stopped further actions.';

					try {
						response = await this.llmProvider.sendMessage(
							systemPrompt,
							workingMessages,
							{ tools: undefined },
							activeProviderType,
						);
						this.accumulateMeta(accumulatedMeta, response.meta);
					} catch {
						// The deterministic uncertainty response must survive provider failure
						// because retrying an action with an unknown outcome may duplicate it.
					}

					return this.clearActiveToolState({ ...response, meta: accumulatedMeta, content: uncertaintyMessage });
				}

				try {
					response = await this.llmProvider.sendMessage(systemPrompt, workingMessages, { tools }, activeProviderType);
					this.accumulateMeta(accumulatedMeta, response.meta);
				} catch {
					return this.clearActiveToolState({
						...response,
						meta: accumulatedMeta,
						content:
							'I processed the requested tool step but could not safely continue the assistant turn. ' +
							'Please check the current state before retrying.',
					});
				}

				continue;
			}

			// Execute all tool calls and include parse errors for malformed arguments
			if (!canReserveBuddyLegacyToolTranscript(response, activeToolTranscriptBytes)) {
				return this.toolLimitResponse(response, accumulatedMeta, hasAttemptedToolExecution);
			}

			const toolResults: { success: boolean; summary: string; compactSummary: string }[] = [];

			// Report malformed tool call arguments back to the LLM as failed results
			if (response.toolErrors && response.toolErrors.length > 0) {
				for (const toolError of response.toolErrors) {
					toolResults.push({
						success: false,
						summary: `Tool "${toolError.toolName}" (id=${toolError.toolCallId}): FAILED — ${toolError.error}`,
						compactSummary: `Tool "${toolError.toolName}" (id=${toolError.toolCallId}): FAILED — ${BUDDY_TRUNCATED_TOOL_RESULT_MESSAGE}`,
					});
				}
			}

			for (const [callIndex, toolCall] of toolCalls.entries()) {
				hasAttemptedToolExecution = true;
				const result = await this.toolProviderRegistry.executeTool(toolCall, {
					audience: ToolAudience.BUDDY,
					source: ToolAudience.BUDDY,
					conversationId,
					requestId: canonicalCallIds[callIndex],
				});

				toolResults.push({
					success: result.success,
					summary: `Tool "${toolCall.name}" (id=${toolCall.id}): ${result.success ? 'SUCCESS' : 'FAILED'} — ${result.message}`,
					compactSummary: `Tool "${toolCall.name}" (id=${toolCall.id}): ${result.success ? 'SUCCESS' : 'FAILED'} — ${BUDDY_TRUNCATED_TOOL_RESULT_MESSAGE}`,
				});
			}

			const allSucceeded = toolResults.every((r) => r.success);

			// Legacy/custom providers may emit a final answer with successful tool calls.
			// Preserve that historical shortcut only for the prose fallback path.
			// If the LLM already provided a final answer alongside the tool calls
			// and all tools succeeded, return the LLM's content as-is.
			// If any tool failed, fall through to re-query the LLM so it can
			// provide an accurate response reflecting the failures.
			if (hasContentWithTools && allSucceeded) {
				return this.clearActiveToolState({ ...response, meta: accumulatedMeta });
			}

			// Append the assistant's tool call response and tool results as a follow-up user message
			// This is a simplified approach that works across providers without requiring
			// provider-specific tool result message formats
			const toolResultsSummary = toolResults.map((r) => r.summary).join('\n');

			const legacyMessages: LlmConversationItem[] = [];

			if (response.content) {
				legacyMessages.push({ role: MessageRole.ASSISTANT, content: response.content });
			} else {
				const toolNames = [
					...(response.toolCalls ?? []).map((tc) => tc.name),
					...(response.toolErrors ?? []).map((te) => `${te.toolName} (parse error)`),
				].join(', ');

				legacyMessages.push({
					role: MessageRole.ASSISTANT,
					content: `[Executing tools: ${toolNames}]`,
				});
			}

			legacyMessages.push({
				role: MessageRole.USER,
				content: `[Tool execution results]\n${toolResultsSummary}\n\nPlease provide a natural language response based on these results.`,
			});

			let legacyTranscriptBytes = fitsBuddyLegacyToolTranscript(legacyMessages, activeToolTranscriptBytes);

			if (legacyTranscriptBytes === null) {
				legacyMessages[legacyMessages.length - 1] = {
					role: MessageRole.USER,
					content:
						`[Tool execution results]\n${toolResults.map((result) => result.compactSummary).join('\n')}\n\n` +
						'Please provide a natural language response based on these results.',
				};
				legacyTranscriptBytes = fitsBuddyLegacyToolTranscript(legacyMessages, activeToolTranscriptBytes);
			}

			if (legacyTranscriptBytes === null) {
				return this.toolLimitResponse(response, accumulatedMeta, hasAttemptedToolExecution);
			}

			activeToolTranscriptBytes = legacyTranscriptBytes;
			workingMessages.push(...legacyMessages);

			// Call LLM again with tools so multi-step tool use works
			try {
				response = await this.llmProvider.sendMessage(
					systemPrompt,
					workingMessages,
					{ tools },
					useNativeToolResults ? activeProviderType : undefined,
				);
				this.accumulateMeta(accumulatedMeta, response.meta);
			} catch (error) {
				if (!useNativeToolResults || callCount === 0) {
					throw error;
				}

				return this.clearActiveToolState({
					...response,
					meta: accumulatedMeta,
					content:
						'I processed the requested tool step but could not safely continue the assistant turn. ' +
						'Please check the current state before retrying.',
				});
			}
		}

		// Never present pre-execution assistant text as final when the loop stops with
		// outstanding tool work. Those final calls have not been executed.
		if (hasToolWork(response)) {
			return this.clearActiveToolState({
				...response,
				meta: accumulatedMeta,
				content:
					'I attempted to perform the requested actions but reached the maximum number of steps. ' +
					'Please try again or simplify your request.',
			});
		}

		return this.clearActiveToolState({ ...response, meta: accumulatedMeta });
	}

	private toolLimitResponse(
		response: LlmResponse,
		meta: LlmResponseMeta,
		hasAttemptedToolExecution: boolean,
	): LlmResponse {
		return this.clearActiveToolState({
			...response,
			meta,
			content: hasAttemptedToolExecution
				? 'I stopped the tool sequence because it exceeded the safe active-turn limits. ' +
					'Earlier steps may have completed; please check the current state before retrying.'
				: 'I could not safely process that many tool operations in one turn. Please simplify the request.',
		});
	}

	private assertNativeProviderCallIds(toolCalls: LlmToolCall[]): void {
		const providerCallIds = new Set<string>();

		for (const [callIndex, toolCall] of toolCalls.entries()) {
			if (toolCall.id.length === 0 || providerCallIds.has(toolCall.id)) {
				throw new BuddyProviderErrorException(
					`Native tool response has an empty or duplicate provider call ID at index ${callIndex}`,
				);
			}

			providerCallIds.add(toolCall.id);
		}
	}

	private toLlmToolResultStatus(status: ToolExecutionStatus): LlmToolResultStatus {
		switch (status) {
			case ToolExecutionStatus.COMPLETED:
				return 'completed';
			case ToolExecutionStatus.PARTIAL:
				return 'partial';
			case ToolExecutionStatus.FAILED:
				return 'failed';
			case ToolExecutionStatus.TIMED_OUT:
				return 'timed_out';
			case ToolExecutionStatus.DENIED:
				return 'denied';
		}
	}

	private clearActiveToolState(response: LlmResponse): LlmResponse {
		return {
			...response,
			toolCalls: undefined,
			toolErrors: undefined,
			providerItems: undefined,
		};
	}

	/**
	 * Accumulate token counts and duration from a new LLM response into the running totals.
	 */
	private accumulateMeta(accumulated: LlmResponseMeta, next: LlmResponseMeta): void {
		accumulated.inputTokens = this.addNullable(accumulated.inputTokens, next.inputTokens);
		accumulated.outputTokens = this.addNullable(accumulated.outputTokens, next.outputTokens);
		accumulated.durationMs = this.addNullable(accumulated.durationMs, next.durationMs);
		accumulated.cacheReadTokens = this.addNullable(accumulated.cacheReadTokens, next.cacheReadTokens);
		accumulated.cacheWriteTokens = this.addNullable(accumulated.cacheWriteTokens, next.cacheWriteTokens);
		accumulated.finishReason = next.finishReason;
	}

	private addNullable(a: number | null, b: number | null): number | null {
		if (a === null && b === null) return null;

		return (a ?? 0) + (b ?? 0);
	}

	private async buildSystemPrompt(
		context: BuddyContext,
		conversationId: string,
		conversationSpaceId?: string,
	): Promise<string> {
		const hasTools = this.llmProvider.supportsTools();
		const personality = await this.personalityService.getPersonality();
		const buddyName = this.getBuddyName();
		let contextWindowTokens = DEFAULT_CONTEXT_WINDOW_TOKENS;
		try {
			contextWindowTokens = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME).contextWindowTokens;
		} catch {
			// Use default if config is unavailable
		}
		const tokenBudget = Math.floor(contextWindowTokens * PROMPT_TOKEN_BUDGET_RATIO);

		// Stage 1: Base instructions (always included)
		const lines: string[] = [`Your name is ${buddyName}.`, '', personality];

		if (hasTools) {
			lines.push(
				'',
				'You can control the home using the provided tools. When the user asks to control a device, run a scene, or change lighting, use the appropriate tool.',
				'Always confirm what you did after executing a tool.',
			);
		}

		lines.push('', `Current time: ${context.timestamp}`);

		// Stage 2: Spaces (lightweight — always included in full)
		if (context.spaces.length > 0) {
			lines.push('', '## Spaces');

			for (const space of context.spaces) {
				const sid = this.shortIdMapping.exposeScoped(conversationId, space.id, ScopedShortIdTargetKind.SPACE);
				const reference = sid === null ? '' : ` [id=${sid}]`;

				lines.push(`- ${space.name}${reference} (${space.category ?? 'unknown'}): ${space.deviceCount} devices`);
			}
		}

		// Stage 3: Devices — check budget before adding full detail
		if (context.devices.length > 0) {
			const currentTokens = estimateTokens(lines.join('\n'));

			if (currentTokens < tokenBudget) {
				this.appendDevices(
					lines,
					context.devices,
					hasTools,
					tokenBudget,
					context.spaces,
					conversationId,
					conversationSpaceId,
				);
			}
		}

		// Stage 4: Scenes
		const omittedSections: string[] = [];

		if (context.scenes.length > 0) {
			const currentTokens = estimateTokens(lines.join('\n'));

			if (currentTokens < tokenBudget) {
				lines.push('', '## Scenes');

				for (const scene of context.scenes) {
					const sid = this.shortIdMapping.exposeScoped(conversationId, scene.id, ScopedShortIdTargetKind.SCENE);
					const reference = sid === null ? '' : ` [id=${sid}]`;

					lines.push(`- ${scene.name}${reference}: ${scene.enabled ? 'enabled' : 'disabled'}`);
				}
			} else {
				omittedSections.push('scenes');
			}
		}

		// Stage 5: Weather
		if (context.weather) {
			const currentTokens = estimateTokens(lines.join('\n'));

			if (currentTokens < tokenBudget) {
				this.appendWeather(lines, context.weather, context.timezone);
			} else {
				omittedSections.push('weather');
			}
		}

		// Stage 6: Energy
		if (context.energy) {
			const currentTokens = estimateTokens(lines.join('\n'));

			if (currentTokens < tokenBudget) {
				lines.push('', '## Energy');
				lines.push(`- Solar production: ${context.energy.solarProduction} kW`);
				lines.push(`- Grid consumption: ${context.energy.gridConsumption} kW`);
				lines.push(`- Grid export: ${context.energy.gridExport} kW`);

				if (context.energy.batteryLevel != null) {
					lines.push(`- Battery level: ${context.energy.batteryLevel}%`);
				}
			} else {
				omittedSections.push('energy data');
			}
		}

		// Stage 7: Recent actions
		if (context.recentIntents.length > 0) {
			const currentTokens = estimateTokens(lines.join('\n'));

			if (currentTokens < tokenBudget) {
				lines.push('', '## Recent Actions');

				for (const intent of context.recentIntents.slice(0, 10)) {
					lines.push(`- ${intent.type} (space: ${intent.space ?? 'unknown'}) at ${intent.timestamp}`);
				}
			} else {
				omittedSections.push('recent actions');
			}
		}

		if (omittedSections.length > 0) {
			lines.push(
				'',
				`_Note: ${omittedSections.join(', ')} omitted due to context size limits. Ask the user for specifics if needed._`,
			);
		}

		return lines.join('\n');
	}

	/**
	 * Append device information to the system prompt lines.
	 * When the full device list would exceed the token budget, devices from the
	 * conversation's current space are prioritized with full detail, while other
	 * spaces are summarized (name + device count only).
	 *
	 * @param conversationSpaceId The conversation's scoped space (if any).
	 *   Only devices in this space are classified as "current". For global
	 *   conversations (undefined), no space is prioritized and all devices
	 *   are grouped by their space equally.
	 */
	private appendDevices(
		lines: string[],
		devices: BuddyContext['devices'],
		hasTools: boolean,
		tokenBudget: number,
		spaces: BuddyContext['spaces'],
		conversationId: string,
		conversationSpaceId?: string,
	): void {
		// Quick estimate: can ALL devices fit with full detail?
		// Use a lightweight character count that avoids building formatted strings
		// or registering short IDs (which would pollute the mapping on discard).
		const fullDetailEstimate = this.estimateDeviceTokens(devices, hasTools);
		const baseTokens = estimateTokens(lines.join('\n'));

		if (baseTokens + fullDetailEstimate < tokenBudget) {
			// Everything fits — build the actual formatted lines (registers short IDs)
			const fullDeviceLines = this.buildDeviceLines(devices, hasTools, conversationId);

			lines.push('', '## Devices', ...fullDeviceLines);

			return;
		}

		// Token budget exceeded — group devices by space, prioritize current space.
		// Only the conversation's explicit spaceId counts as "current" — for global
		// conversations (no spaceId), no space is prioritized and all groups are
		// treated equally.
		const currentSpaceDevices: BuddyContext['devices'] = [];
		const otherSpaceDevices = new Map<string | null, BuddyContext['devices']>();

		for (const device of devices) {
			if (conversationSpaceId && device.space === conversationSpaceId) {
				currentSpaceDevices.push(device);
			} else {
				const key = device.space;

				if (!otherSpaceDevices.has(key)) {
					otherSpaceDevices.set(key, []);
				}

				otherSpaceDevices.get(key)?.push(device);
			}
		}

		lines.push('', '## Devices');

		let truncated = false;

		// Add current space devices with full detail (or summarize if still too large)
		if (currentSpaceDevices.length > 0) {
			const withCurrentSpace =
				estimateTokens(lines.join('\n')) + this.estimateDeviceTokens(currentSpaceDevices, hasTools);

			if (withCurrentSpace < tokenBudget) {
				lines.push(...this.buildDeviceLines(currentSpaceDevices, hasTools, conversationId));
			} else {
				// Even current space exceeds budget — add without tool details
				for (const device of currentSpaceDevices) {
					const currentTokens = estimateTokens(lines.join('\n'));

					if (currentTokens >= tokenBudget) {
						break;
					}

					const stateEntries = Object.entries(device.state);
					const stateStr =
						stateEntries.length > 0
							? stateEntries
									.slice(0, 3)
									.map(([k, v]) => `${k}=${v != null ? JSON.stringify(v) : 'null'}`)
									.join(', ') + (stateEntries.length > 3 ? ', ...' : '')
							: 'no state data';

					lines.push(`- ${device.name} (${device.category}): ${stateStr}`);
				}

				truncated = true;
			}
		}

		// Add other space devices as summaries if budget allows
		for (const [spaceId, spaceDevices] of otherSpaceDevices) {
			const currentTokens = estimateTokens(lines.join('\n'));

			if (currentTokens >= tokenBudget) {
				truncated = true;

				break;
			}

			// Estimate without exposing action references; allocate them only after the detail block is accepted.
			const withFullDetail = estimateTokens(lines.join('\n')) + this.estimateDeviceTokens(spaceDevices, hasTools);

			if (withFullDetail < tokenBudget) {
				lines.push(...this.buildDeviceLines(spaceDevices, hasTools, conversationId));
			} else {
				// Summarize: just device count for this space
				const spaceName = spaces.find((s) => s.id === spaceId)?.name ?? spaceId ?? 'unassigned';

				lines.push(`- [${spaceName}: ${spaceDevices.length} device(s) — ask for details]`);
				truncated = true;
			}
		}

		if (truncated) {
			lines.push('', '_Some devices omitted for brevity. Ask about specific rooms for details._');
		}
	}

	/**
	 * Build device detail lines (shared between full and truncated rendering).
	 */
	private buildDeviceLines(devices: BuddyContext['devices'], hasTools: boolean, conversationId: string): string[] {
		const lines: string[] = [];

		for (const device of devices) {
			const stateEntries = Object.entries(device.state);
			const stateStr =
				stateEntries.length > 0
					? stateEntries
							.map(([k, v]) => {
								const val = v != null ? JSON.stringify(v) : 'null';

								return `${k}=${val}`;
							})
							.join(', ')
					: 'no state data';

			lines.push(`- ${device.name} (${device.category}): ${stateStr}`);

			if (hasTools && device.channels.length > 0) {
				for (const channel of device.channels) {
					if (channel.properties.length === 0) {
						continue;
					}

					lines.push(`  - ${channel.name}:`);

					for (const prop of channel.properties) {
						const pid = this.shortIdMapping.exposeScoped(conversationId, prop.id, ScopedShortIdTargetKind.PROPERTY);
						const val = prop.value != null ? JSON.stringify(prop.value) : 'null';
						const reference = pid === null ? '' : ` [p=${pid}]`;

						lines.push(`    - ${prop.category}${reference} value=${val}`);
					}
				}
			}
		}

		return lines;
	}

	/**
	 * Lightweight token estimate for a list of devices WITHOUT building
	 * formatted strings or registering short IDs. Uses fixed per-element
	 * character estimates derived from the format in `buildDeviceLines`.
	 */
	private estimateDeviceTokens(devices: BuddyContext['devices'], hasTools: boolean): number {
		// "- DeviceName (category): key=val, key=val\n" ≈ 60 chars base + 20 per state entry
		const DEVICE_BASE_CHARS = 60;
		const STATE_ENTRY_CHARS = 20;
		// "  - channelName:\n" ≈ 25 chars
		const CHANNEL_CHARS = 25;
		// "    - category [p=pr_<opaque-reference>] value=...\n" ≈ 60 chars
		const PROPERTY_CHARS = 60;
		// "## Devices\n\n"
		const HEADER_CHARS = 15;

		let chars = HEADER_CHARS;

		for (const device of devices) {
			const stateCount = Object.keys(device.state).length;

			chars += DEVICE_BASE_CHARS + stateCount * STATE_ENTRY_CHARS;

			if (hasTools) {
				for (const channel of device.channels) {
					if (channel.properties.length > 0) {
						chars += CHANNEL_CHARS + channel.properties.length * PROPERTY_CHARS;
					}
				}
			}
		}

		return Math.ceil(chars / 3);
	}

	/**
	 * Append weather information to the system prompt lines.
	 */
	private appendWeather(lines: string[], weather: NonNullable<BuddyContext['weather']>, timezone: string): void {
		const w = weather.current;

		lines.push('', '## Current Weather');
		lines.push(`- Temperature: ${w.temperature}°C (feels like ${w.feelsLike}°C)`);
		lines.push(`- Conditions: ${w.conditions}, Clouds: ${w.clouds}%`);
		lines.push(`- Humidity: ${w.humidity}%, Pressure: ${w.pressure} hPa`);

		const gustStr = w.wind.gust != null ? ` (gusts ${w.wind.gust} m/s)` : '';

		lines.push(`- Wind: ${w.wind.speed} m/s${gustStr}`);

		if (w.rain != null && w.rain > 0) {
			lines.push(`- Rain: ${w.rain} mm`);
		}

		if (w.snow != null && w.snow > 0) {
			lines.push(`- Snow: ${w.snow} mm`);
		}

		const tz = timezone;

		const formatTime = (iso: string): string => {
			const d = new Date(iso);

			return d.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
		};

		lines.push(`- Sunrise: ${formatTime(w.sunrise)}, Sunset: ${formatTime(w.sunset)}`);

		if (weather.forecast.length > 0) {
			lines.push('', '## Weather Forecast');

			for (const f of weather.forecast) {
				const date = new Date(f.date);
				const dateStr = date.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' });
				let line = `- ${dateStr}: ${f.conditions}, ${f.tempMin}–${f.tempMax}°C, wind ${f.wind} m/s, humidity ${f.humidity}%`;

				if (f.rain != null && f.rain > 0) {
					line += `, rain ${f.rain} mm`;
				}

				if (f.snow != null && f.snow > 0) {
					line += `, snow ${f.snow} mm`;
				}

				lines.push(line);
			}
		}

		if (weather.alerts.length > 0) {
			lines.push('', '## Weather Alerts');

			for (const a of weather.alerts) {
				const startDate = new Date(a.start);
				const endDate = new Date(a.end);
				const fmt = (d: Date) =>
					`${d.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })}`;

				lines.push(`- ${a.event} (${fmt(startDate)} – ${fmt(endDate)}): ${a.description}`);
			}
		}
	}

	private getBuddyName(): string {
		try {
			const config = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);

			return config.name || 'Buddy';
		} catch {
			return 'Buddy';
		}
	}

	private getMaxToolIterations(): number {
		try {
			const config = this.configService.getModuleConfig<BuddyConfigModel>(BUDDY_MODULE_NAME);

			return config.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;
		} catch {
			return DEFAULT_MAX_TOOL_ITERATIONS;
		}
	}
}
