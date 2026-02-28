/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EventType, MessageRole } from '../buddy.constants';
import { BuddyConversationNotFoundException, BuddyProviderNotConfiguredException } from '../buddy.exceptions';
import { BuddyConversationEntity } from '../entities/buddy-conversation.entity';
import { BuddyMessageEntity } from '../entities/buddy-message.entity';

import { BuddyConversationService } from './buddy-conversation.service';

describe('BuddyConversationService', () => {
	let service: BuddyConversationService;
	let conversationRepo: Record<string, jest.Mock>;
	let messageRepo: Record<string, jest.Mock>;
	let dataSource: Record<string, jest.Mock>;
	let llmProvider: Record<string, jest.Mock>;
	let contextService: Record<string, jest.Mock>;
	let eventEmitter: jest.Mocked<EventEmitter2>;

	const mockConversation: BuddyConversationEntity = {
		id: 'conv-1',
		title: null,
		spaceId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	beforeEach(() => {
		conversationRepo = {
			find: jest.fn().mockResolvedValue([mockConversation]),
			findOne: jest.fn().mockResolvedValue(mockConversation),
			create: jest.fn((data: Partial<BuddyConversationEntity>) => ({ ...data }) as BuddyConversationEntity),
			save: jest.fn((entity: BuddyConversationEntity) => Promise.resolve(entity)),
			delete: jest.fn().mockResolvedValue({ affected: 1 }),
		};

		messageRepo = {
			find: jest.fn().mockResolvedValue([]),
			delete: jest.fn().mockResolvedValue({ affected: 0 }),
		};

		dataSource = {
			transaction: jest.fn(async (fn: (manager: Record<string, jest.Mock>) => Promise<unknown>) => {
				const manager = {
					create: jest.fn(
						(_Entity: unknown, data: Partial<BuddyMessageEntity>) => ({ ...data }) as BuddyMessageEntity,
					),
					save: jest.fn((entity: BuddyMessageEntity) => Promise.resolve(entity)),
					update: jest.fn().mockResolvedValue(undefined),
				};

				return fn(manager);
			}),
		};

		llmProvider = {
			sendMessage: jest.fn().mockResolvedValue('Mocked response'),
		};

		contextService = {
			buildContext: jest.fn().mockResolvedValue({
				timestamp: new Date().toISOString(),
				spaces: [],
				devices: [],
				scenes: [],
				weather: null,
				energy: null,
				recentIntents: [],
			}),
		};

		eventEmitter = {
			emit: jest.fn(),
		} as any;

		service = new BuddyConversationService(
			conversationRepo as any,
			messageRepo as any,
			dataSource as any,
			llmProvider as any,
			contextService as any,
			eventEmitter,
		);
	});

	describe('findAll', () => {
		it('should return all conversations', async () => {
			const result = await service.findAll();

			expect(result).toHaveLength(1);
			expect(conversationRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
		});
	});

	describe('findOne', () => {
		it('should return a conversation by ID', async () => {
			const result = await service.findOne('conv-1');

			expect(result).toEqual(mockConversation);
			expect(conversationRepo.findOne).toHaveBeenCalledWith({ where: { id: 'conv-1' } });
		});

		it('should return null when conversation not found', async () => {
			conversationRepo.findOne.mockResolvedValue(null);

			const result = await service.findOne('nonexistent');

			expect(result).toBeNull();
		});
	});

	describe('findOneOrThrow', () => {
		it('should return a conversation when found', async () => {
			const result = await service.findOneOrThrow('conv-1');

			expect(result.id).toBe('conv-1');
		});

		it('should throw BuddyConversationNotFoundException when not found', async () => {
			conversationRepo.findOne.mockResolvedValue(null);

			await expect(service.findOneOrThrow('nonexistent')).rejects.toThrow(BuddyConversationNotFoundException);
		});
	});

	describe('create', () => {
		it('should create a new conversation', async () => {
			const result = await service.create('My Chat', 'space-1');

			expect(result.title).toBe('My Chat');
			expect(result.spaceId).toBe('space-1');
			expect(conversationRepo.save).toHaveBeenCalled();
		});

		it('should create conversation with null title and spaceId when not provided', async () => {
			const result = await service.create();

			expect(result.title).toBeNull();
			expect(result.spaceId).toBeNull();
		});
	});

	describe('sendMessage', () => {
		it('should send a message and return the assistant response', async () => {
			const result = await service.sendMessage('conv-1', 'Hello buddy!');

			expect(result.role).toBe(MessageRole.ASSISTANT);
			expect(result.content).toBe('Mocked response');
		});

		it('should build context from context service', async () => {
			await service.sendMessage('conv-1', 'Hello');

			expect(contextService.buildContext).toHaveBeenCalled();
		});

		it('should call LLM provider with system prompt and messages', async () => {
			await service.sendMessage('conv-1', 'What is the temperature?');

			expect(llmProvider.sendMessage).toHaveBeenCalledWith(
				expect.stringContaining('smart home assistant'),
				expect.arrayContaining([
					expect.objectContaining({ role: MessageRole.USER, content: 'What is the temperature?' }),
				]),
			);
		});

		it('should emit CONVERSATION_MESSAGE_RECEIVED event', async () => {
			await service.sendMessage('conv-1', 'Hello');

			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CONVERSATION_MESSAGE_RECEIVED,
				expect.objectContaining({
					conversation_id: 'conv-1',
					role: MessageRole.ASSISTANT,
					content: 'Mocked response',
				}),
			);
		});

		it('should throw BuddyConversationNotFoundException for non-existent conversation', async () => {
			conversationRepo.findOne.mockResolvedValue(null);

			await expect(service.sendMessage('nonexistent', 'Hello')).rejects.toThrow(
				BuddyConversationNotFoundException,
			);
		});

		it('should propagate BuddyProviderNotConfiguredException from LLM provider', async () => {
			llmProvider.sendMessage.mockRejectedValue(new BuddyProviderNotConfiguredException());

			await expect(service.sendMessage('conv-1', 'Hello')).rejects.toThrow(
				BuddyProviderNotConfiguredException,
			);
		});

		it('should load recent message history for LLM context', async () => {
			const previousMessages: Partial<BuddyMessageEntity>[] = [
				{ role: MessageRole.USER, content: 'Previous question' },
				{ role: MessageRole.ASSISTANT, content: 'Previous answer' },
			];

			messageRepo.find.mockResolvedValue(previousMessages);

			await service.sendMessage('conv-1', 'Follow-up');

			expect(llmProvider.sendMessage).toHaveBeenCalledWith(
				expect.any(String),
				expect.arrayContaining([
					expect.objectContaining({ role: MessageRole.USER, content: 'Previous question' }),
					expect.objectContaining({ role: MessageRole.ASSISTANT, content: 'Previous answer' }),
					expect.objectContaining({ role: MessageRole.USER, content: 'Follow-up' }),
				]),
			);
		});
	});

	describe('remove', () => {
		it('should delete conversation and its messages', async () => {
			await service.remove('conv-1');

			expect(messageRepo.delete).toHaveBeenCalledWith({ conversationId: 'conv-1' });
			expect(conversationRepo.delete).toHaveBeenCalledWith('conv-1');
		});

		it('should throw BuddyConversationNotFoundException when not found', async () => {
			conversationRepo.findOne.mockResolvedValue(null);

			await expect(service.remove('nonexistent')).rejects.toThrow(BuddyConversationNotFoundException);
		});
	});
});
