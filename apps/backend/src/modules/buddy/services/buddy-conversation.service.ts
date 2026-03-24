import { DataSource as OrmDataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { ShortIdMappingService } from '../../tools/services/short-id-mapping.service';
import { ToolProviderRegistryService } from '../../tools/services/tool-provider-registry.service';
import {
	BUDDY_MODULE_NAME,
	DEFAULT_CONTEXT_WINDOW_TOKENS,
	DEFAULT_MAX_TOOL_ITERATIONS,
	EventType,
	MessageRole,
} from '../buddy.constants';
import { BuddyConversationNotFoundException } from '../buddy.exceptions';
import { BuddyConversationEntity } from '../entities/buddy-conversation.entity';
import { BuddyMessageEntity } from '../entities/buddy-message.entity';
import { BuddyConfigModel } from '../models/config.model';
import { LlmResponse, LlmResponseMeta, ToolDefinition } from '../platforms/llm-provider.platform';

import { BuddyContext, BuddyContextService } from './buddy-context.service';
import { BuddyPersonalityService } from './buddy-personality.service';
import { ChatMessage, LlmProviderService } from './llm-provider.service';

const MAX_HISTORY_MESSAGES = 20;

/**
 * Default token budget as a fraction of the model's context window.
 * When the system prompt exceeds this ratio, devices/properties are truncated.
 */
const PROMPT_TOKEN_BUDGET_RATIO = 0.8;

/**
 * Estimate the number of tokens in a text string.
 * Uses the ~4 characters per token heuristic for English text.
 */
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
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
		const systemPrompt = await this.buildSystemPrompt(context, conversation.spaceId ?? undefined);

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
		const tools = this.llmProvider.supportsTools() ? this.toolProviderRegistry.getAllToolDefinitions() : undefined;
		const maxIterations = this.getMaxToolIterations();
		const llmResponse = await this.sendWithToolExecution(systemPrompt, chatMessages, tools, maxIterations);

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
		messages: ChatMessage[],
		tools?: ToolDefinition[],
		maxIterations: number = DEFAULT_MAX_TOOL_ITERATIONS,
	): Promise<LlmResponse> {
		// Work on a shallow copy so we never mutate the caller's array
		const workingMessages = [...messages];

		let response = await this.llmProvider.sendMessage(systemPrompt, workingMessages, { tools });

		// If no tool calls, return directly
		if (!response.toolCalls || response.toolCalls.length === 0) {
			return response;
		}

		// Accumulate token usage and duration across all LLM calls
		const accumulatedMeta = { ...response.meta };

		// Tool execution loop
		for (let iteration = 0; iteration < maxIterations; iteration++) {
			if (!response.toolCalls || response.toolCalls.length === 0) {
				break;
			}

			// If the LLM returned both content and tool calls, the content is its final answer.
			// Execute the tools for their side effects but return the response as-is afterwards.
			const hasContentWithTools = !!response.content;

			this.logger.debug(`Tool iteration ${iteration + 1}: executing ${response.toolCalls.length} tool call(s)`);

			// Execute all tool calls
			const toolResults: { success: boolean; summary: string }[] = [];

			for (const toolCall of response.toolCalls) {
				const result = await this.toolProviderRegistry.executeTool(toolCall);

				toolResults.push({
					success: result.success,
					summary: `Tool "${toolCall.name}" (id=${toolCall.id}): ${result.success ? 'SUCCESS' : 'FAILED'} — ${result.message}`,
				});
			}

			const allSucceeded = toolResults.every((r) => r.success);

			// If the LLM already provided a final answer alongside the tool calls
			// and all tools succeeded, return the LLM's content as-is.
			// If any tool failed, fall through to re-query the LLM so it can
			// provide an accurate response reflecting the failures.
			if (hasContentWithTools && allSucceeded) {
				return { ...response, meta: accumulatedMeta, toolCalls: undefined };
			}

			// Append the assistant's tool call response and tool results as a follow-up user message
			// This is a simplified approach that works across providers without requiring
			// provider-specific tool result message formats
			const toolResultsSummary = toolResults.map((r) => r.summary).join('\n');

			if (response.content) {
				workingMessages.push({ role: MessageRole.ASSISTANT, content: response.content });
			} else {
				const toolNames = response.toolCalls.map((tc) => tc.name).join(', ');

				workingMessages.push({
					role: MessageRole.ASSISTANT,
					content: `[Executing tools: ${toolNames}]`,
				});
			}

			workingMessages.push({
				role: MessageRole.USER,
				content: `[Tool execution results]\n${toolResultsSummary}\n\nPlease provide a natural language response based on these results.`,
			});

			// Call LLM again with tools so multi-step tool use works
			response = await this.llmProvider.sendMessage(systemPrompt, workingMessages, { tools });
			this.accumulateMeta(accumulatedMeta, response.meta);
		}

		// If loop exhausted and final response has no text content, provide a fallback
		if (!response.content && response.toolCalls && response.toolCalls.length > 0) {
			return {
				...response,
				meta: accumulatedMeta,
				content:
					'I attempted to perform the requested actions but reached the maximum number of steps. ' +
					'Please try again or simplify your request.',
				toolCalls: undefined,
			};
		}

		return { ...response, meta: accumulatedMeta, toolCalls: undefined };
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

	private async buildSystemPrompt(context: BuddyContext, conversationSpaceId?: string): Promise<string> {
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
				const sid = this.shortIdMapping.shorten(space.id);

				lines.push(`- ${space.name} [id=${sid}] (${space.category ?? 'unknown'}): ${space.deviceCount} devices`);
			}
		}

		// Stage 3: Devices — check budget before adding full detail
		if (context.devices.length > 0) {
			const currentTokens = estimateTokens(lines.join('\n'));

			if (currentTokens < tokenBudget) {
				this.appendDevices(lines, context.devices, hasTools, tokenBudget, context.spaces, conversationSpaceId);
			}
		}

		// Stage 4: Scenes
		const omittedSections: string[] = [];

		if (context.scenes.length > 0) {
			const currentTokens = estimateTokens(lines.join('\n'));

			if (currentTokens < tokenBudget) {
				lines.push('', '## Scenes');

				for (const scene of context.scenes) {
					const sid = this.shortIdMapping.shorten(scene.id);

					lines.push(`- ${scene.name} [id=${sid}]: ${scene.enabled ? 'enabled' : 'disabled'}`);
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
		conversationSpaceId?: string,
	): void {
		// Quick estimate: can ALL devices fit with full detail?
		// Use a lightweight character count that avoids building formatted strings
		// or registering short IDs (which would pollute the mapping on discard).
		const fullDetailEstimate = this.estimateDeviceTokens(devices, hasTools);
		const baseTokens = estimateTokens(lines.join('\n'));

		if (baseTokens + fullDetailEstimate < tokenBudget) {
			// Everything fits — build the actual formatted lines (registers short IDs)
			const fullDeviceLines = this.buildDeviceLines(devices, hasTools);

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
			const currentLines = this.buildDeviceLines(currentSpaceDevices, hasTools);
			const withCurrentSpace = estimateTokens([...lines, ...currentLines].join('\n'));

			if (withCurrentSpace < tokenBudget) {
				lines.push(...currentLines);
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

			// Try full detail for this space's devices
			const spaceDeviceLines = this.buildDeviceLines(spaceDevices, hasTools);
			const withFullDetail = estimateTokens([...lines, ...spaceDeviceLines].join('\n'));

			if (withFullDetail < tokenBudget) {
				lines.push(...spaceDeviceLines);
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
	private buildDeviceLines(devices: BuddyContext['devices'], hasTools: boolean): string[] {
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
						const pid = this.shortIdMapping.shorten(prop.id);
						const val = prop.value != null ? JSON.stringify(prop.value) : 'null';

						lines.push(`    - ${prop.category} [p=${pid}] value=${val}`);
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
		// "    - category [p=XXXX] value=...\n" ≈ 45 chars
		const PROPERTY_CHARS = 45;
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

		return Math.ceil(chars / 4);
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
