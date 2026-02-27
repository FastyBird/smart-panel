import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { EventType, MessageRole } from '../buddy.constants';
import { BuddyConversationNotFoundException } from '../buddy.exceptions';
import { BuddyConversationEntity } from '../entities/buddy-conversation.entity';
import { BuddyMessageEntity } from '../entities/buddy-message.entity';

import { type BuddyContext, BuddyContextService } from './buddy-context.service';
import { type ChatMessage, LlmProviderService } from './llm-provider.service';

const MAX_HISTORY_MESSAGES = 20;

@Injectable()
export class BuddyConversationService {
	private readonly logger = new Logger(BuddyConversationService.name);

	constructor(
		@InjectRepository(BuddyConversationEntity)
		private readonly conversationRepository: Repository<BuddyConversationEntity>,
		@InjectRepository(BuddyMessageEntity)
		private readonly messageRepository: Repository<BuddyMessageEntity>,
		private readonly llmProvider: LlmProviderService,
		private readonly contextService: BuddyContextService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll(): Promise<BuddyConversationEntity[]> {
		this.logger.debug('Fetching all conversations');

		return this.conversationRepository.find({
			order: { createdAt: 'DESC' },
		});
	}

	async findOne(id: string): Promise<BuddyConversationEntity | null> {
		this.logger.debug(`Fetching conversation id=${id}`);

		return this.conversationRepository.findOne({
			where: { id },
			relations: ['messages'],
			order: { messages: { createdAt: 'ASC' } },
		});
	}

	async getOneOrThrow(id: string): Promise<BuddyConversationEntity> {
		const conversation = await this.findOne(id);

		if (!conversation) {
			throw new BuddyConversationNotFoundException(id);
		}

		return conversation;
	}

	async create(title?: string, spaceId?: string): Promise<BuddyConversationEntity> {
		this.logger.debug('Creating new conversation');

		const conversation = this.conversationRepository.create({
			id: uuid(),
			title: title ?? null,
			spaceId: spaceId ?? null,
		});

		await this.conversationRepository.save(conversation);

		this.logger.debug(`Created conversation id=${conversation.id}`);

		return conversation;
	}

	async sendMessage(conversationId: string, userContent: string): Promise<BuddyMessageEntity> {
		const conversation = await this.getOneOrThrow(conversationId);

		// 1. Persist user message
		const userMessage = this.messageRepository.create({
			id: uuid(),
			conversationId: conversation.id,
			role: MessageRole.USER,
			content: userContent,
		});

		await this.messageRepository.save(userMessage);
		this.logger.debug(`Saved user message id=${userMessage.id}`);

		// 2. Build system prompt with context
		const context = await this.contextService.buildContext(conversation.spaceId ?? undefined);
		const systemPrompt = this.buildSystemPrompt(context);

		// 3. Load conversation history
		const history = await this.loadConversationHistory(conversationId);

		// 4. Call LLM
		const assistantContent = await this.llmProvider.sendMessage(systemPrompt, history);

		// 5. Persist assistant response
		const assistantMessage = this.messageRepository.create({
			id: uuid(),
			conversationId: conversation.id,
			role: MessageRole.ASSISTANT,
			content: assistantContent,
		});

		await this.messageRepository.save(assistantMessage);
		this.logger.debug(`Saved assistant message id=${assistantMessage.id}`);

		// 6. Emit event
		this.eventEmitter.emit(EventType.CONVERSATION_MESSAGE_RECEIVED, {
			conversation_id: conversation.id,
			message_id: assistantMessage.id,
			role: assistantMessage.role,
			content: assistantMessage.content,
			created_at:
				assistantMessage.createdAt instanceof Date
					? assistantMessage.createdAt.toISOString()
					: new Date().toISOString(),
		});

		// 7. Return assistant message
		return assistantMessage;
	}

	async remove(id: string): Promise<void> {
		const conversation = await this.getOneOrThrow(id);

		await this.conversationRepository.remove(conversation);

		this.logger.debug(`Deleted conversation id=${id}`);
	}

	private async loadConversationHistory(conversationId: string): Promise<ChatMessage[]> {
		const messages = await this.messageRepository.find({
			where: { conversationId },
			order: { createdAt: 'ASC' },
			take: MAX_HISTORY_MESSAGES,
		});

		return messages.map((m) => ({
			role: m.role as ChatMessage['role'],
			content: m.content,
		}));
	}

	private buildSystemPrompt(context: BuddyContext): string {
		const lines: string[] = [
			'You are a smart home assistant for the FastyBird Smart Panel.',
			'Answer questions about the home, suggest actions, and help the operator manage their smart home.',
			'Be concise and helpful. Use the context below to answer questions accurately.',
			'',
			`Current time: ${context.timestamp}`,
		];

		if (context.spaces.length > 0) {
			lines.push('', '## Spaces');

			for (const space of context.spaces) {
				lines.push(`- ${space.name} (${space.category}): ${String(space.deviceCount)} devices`);
			}
		}

		if (context.devices.length > 0) {
			lines.push('', '## Devices');

			for (const device of context.devices) {
				const stateEntries = Object.entries(device.state);
				const stateStr =
					stateEntries.length > 0
						? stateEntries
								.map(([k, v]) => {
									const val =
										typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : 'unknown';

									return `${k}=${val}`;
								})
								.join(', ')
						: 'no state data';
				const spaceName = device.space ?? 'unassigned';

				lines.push(`- ${spaceName} / ${device.name} (${device.category}): ${stateStr}`);
			}
		}

		if (context.scenes.length > 0) {
			lines.push('', '## Scenes');

			for (const scene of context.scenes) {
				lines.push(`- ${scene.name}: ${scene.enabled ? 'enabled' : 'disabled'}`);
			}
		}

		if (context.weather) {
			lines.push('', '## Weather');
			lines.push(
				`- Temperature: ${String(context.weather.temperature)}°C, ${context.weather.conditions}, Humidity: ${String(context.weather.humidity)}%`,
			);
		}

		if (context.energy) {
			lines.push('', '## Energy');
			lines.push(
				`- Solar: ${String(context.energy.solarProduction)} kWh, Grid: ${String(context.energy.gridConsumption)} kWh`,
			);
		}

		if (context.recentIntents.length > 0) {
			lines.push('', '## Recent Actions');

			for (const intent of context.recentIntents.slice(0, 10)) {
				lines.push(`- ${intent.type} in ${intent.space ?? 'unknown'} at ${intent.timestamp}`);
			}
		}

		return lines.join('\n');
	}
}
