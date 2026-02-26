import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { EventType, MessageRole } from '../buddy.constants';
import { BuddyConversationNotFoundException } from '../buddy.exceptions';
import { BuddyConversationEntity } from '../entities/buddy-conversation.entity';
import { BuddyMessageEntity } from '../entities/buddy-message.entity';

import { BuddyContext, BuddyContextService } from './buddy-context.service';
import { ChatMessage, LlmProviderService } from './llm-provider.service';

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
		return this.conversationRepository.find({
			order: { createdAt: 'DESC' },
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

		// 1. Persist user message
		const userMessage = this.messageRepository.create({
			id: uuid(),
			conversationId: conversation.id,
			role: MessageRole.USER,
			content,
		});

		await this.messageRepository.save(userMessage);

		// 2. Build system prompt with context
		const context = await this.contextService.buildContext(conversation.spaceId ?? undefined);
		const systemPrompt = this.buildSystemPrompt(context);

		// 3. Load most recent conversation history (query DESC to get latest, then reverse for chronological order)
		const history = await this.messageRepository.find({
			where: { conversationId: conversation.id },
			order: { createdAt: 'DESC' },
			take: MAX_HISTORY_MESSAGES,
		});

		history.reverse();

		const chatMessages: ChatMessage[] = history
			.filter((m) => m.role === (MessageRole.USER as string) || m.role === (MessageRole.ASSISTANT as string))
			.map((m) => ({
				role: m.role as MessageRole,
				content: m.content,
			}));

		// 4. Call LLM provider
		const response = await this.llmProvider.sendMessage(systemPrompt, chatMessages);

		// 5. Persist assistant response
		const assistantMessage = this.messageRepository.create({
			id: uuid(),
			conversationId: conversation.id,
			role: MessageRole.ASSISTANT,
			content: response,
		});

		const savedAssistant = await this.messageRepository.save(assistantMessage);

		// 6. Update conversation title from first message if no title set
		if (!conversation.title) {
			const autoTitle = content.length > 50 ? content.substring(0, 47) + '...' : content;

			await this.conversationRepository.update(conversation.id, { title: autoTitle });
		}

		// 7. Emit WebSocket event
		this.eventEmitter.emit(EventType.CONVERSATION_MESSAGE_RECEIVED, {
			conversation_id: conversation.id,
			message_id: savedAssistant.id,
			role: MessageRole.ASSISTANT,
			content: response,
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

	private buildSystemPrompt(context: BuddyContext): string {
		const lines: string[] = [
			'You are a smart home assistant for the FastyBird Smart Panel.',
			'Answer questions about the home, suggest improvements, and help the user manage their smart home.',
			'Be concise, helpful, and friendly. Use the context below to inform your responses.',
			'',
			`Current time: ${context.timestamp}`,
		];

		if (context.spaces.length > 0) {
			lines.push('', '## Spaces');

			for (const space of context.spaces) {
				lines.push(`- ${space.name} (${space.category ?? 'unknown'}): ${space.deviceCount} devices`);
			}
		}

		if (context.devices.length > 0) {
			lines.push('', '## Devices');

			for (const device of context.devices.slice(0, 30)) {
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
			}

			if (context.devices.length > 30) {
				lines.push(`- ... and ${context.devices.length - 30} more devices`);
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
				`- Temperature: ${context.weather.temperature}°C, Conditions: ${context.weather.conditions}, Humidity: ${context.weather.humidity}%`,
			);
		}

		if (context.energy) {
			lines.push('', '## Energy');
			lines.push(`- Solar production: ${context.energy.solarProduction} kWh`);
			lines.push(`- Grid consumption: ${context.energy.gridConsumption} kWh`);
			lines.push(`- Battery level: ${context.energy.batteryLevel}%`);
		}

		if (context.recentIntents.length > 0) {
			lines.push('', '## Recent Actions');

			for (const intent of context.recentIntents.slice(0, 10)) {
				lines.push(`- ${intent.type} (space: ${intent.space ?? 'unknown'}) at ${intent.timestamp}`);
			}
		}

		return lines.join('\n');
	}
}
