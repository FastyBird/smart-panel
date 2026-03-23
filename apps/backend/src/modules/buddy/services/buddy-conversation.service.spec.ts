/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { DataSource as OrmDataSource, Repository } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { ConfigService } from '../../config/services/config.service';
import { ShortIdMappingService } from '../../tools/services/short-id-mapping.service';
import { ToolProviderRegistryService } from '../../tools/services/tool-provider-registry.service';
import { EventType, MessageRole } from '../buddy.constants';
import { BuddyConversationNotFoundException, BuddyProviderNotConfiguredException } from '../buddy.exceptions';
import { BuddyConversationEntity } from '../entities/buddy-conversation.entity';
import { BuddyMessageEntity } from '../entities/buddy-message.entity';

import { BuddyContextService } from './buddy-context.service';
import { BuddyConversationService } from './buddy-conversation.service';
import { BuddyPersonalityService } from './buddy-personality.service';
import { LlmProviderService } from './llm-provider.service';

/**
 * Helper to generate N fake devices with channels and properties.
 * Each device gets 3 channels with 5 properties each to simulate a realistic home.
 */
function generateDevices(
	count: number,
	spaceId: string | null = null,
): {
	id: string;
	name: string;
	space: string | null;
	category: string;
	state: Record<string, unknown>;
	channels: { id: string; name: string; properties: { id: string; category: string; value: unknown }[] }[];
}[] {
	return Array.from({ length: count }, (_, i) => {
		const channels = Array.from({ length: 3 }, (_, ch) => ({
			id: `ch-${i}-${ch}`,
			name: `channel_${ch}`,
			properties: Array.from({ length: 5 }, (_, p) => ({
				id: `prop-${i}-${ch}-${p}`,
				category: `sensor_${p}`,
				value: Math.round(Math.random() * 100) / 10,
			})),
		}));

		const state: Record<string, unknown> = {};

		for (const ch of channels) {
			for (const prop of ch.properties) {
				state[`${ch.name}.${prop.category}`] = prop.value;
			}
		}

		return {
			id: `device-${i}`,
			name: `Device ${i}`,
			space: spaceId,
			category: 'sensor',
			state,
			channels,
		};
	});
}

describe('BuddyConversationService', () => {
	let service: BuddyConversationService;
	let conversationRepo: Record<string, jest.Mock>;
	let messageRepo: Record<string, jest.Mock>;
	let dataSource: Record<string, jest.Mock>;
	let llmProvider: Record<string, jest.Mock>;
	let contextService: Record<string, jest.Mock>;
	let personalityService: Record<string, jest.Mock>;
	let toolProviderRegistry: Record<string, jest.Mock>;
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

		const mockQueryBuilder = {
			update: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue({ affected: 1 }),
		};

		dataSource = {
			transaction: jest.fn(async (fn: (manager: Record<string, jest.Mock>) => Promise<unknown>) => {
				const manager = {
					create: jest.fn((_Entity: unknown, data: Partial<BuddyMessageEntity>) => ({ ...data }) as BuddyMessageEntity),
					save: jest.fn((entity: BuddyMessageEntity) => Promise.resolve(entity)),
					update: jest.fn().mockResolvedValue(undefined),
					createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
				};

				return fn(manager);
			}),
		};

		llmProvider = {
			sendMessage: jest.fn().mockResolvedValue({
				content: 'Mocked response',
				meta: {
					provider: 'buddy-claude-plugin',
					model: 'claude-sonnet-4-20250514',
					inputTokens: 100,
					outputTokens: 50,
					finishReason: 'end_turn',
					durationMs: 1200,
					cacheReadTokens: null,
					cacheWriteTokens: null,
				},
			}),
			supportsTools: jest.fn().mockReturnValue(false),
		};

		contextService = {
			buildContext: jest.fn().mockResolvedValue({
				timestamp: new Date().toISOString(),
				timezone: 'Europe/Prague',
				spaces: [],
				devices: [],
				scenes: [],
				weather: null,
				energy: null,
				recentIntents: [],
			}),
		};

		personalityService = {
			getPersonality: jest
				.fn()
				.mockResolvedValue(
					'You are a helpful smart home assistant. Be concise, friendly, and practical.\nFocus on actionable suggestions. Use simple language.',
				),
		};

		toolProviderRegistry = {
			getAllToolDefinitions: jest.fn().mockReturnValue([]),
			executeTool: jest.fn().mockResolvedValue({ success: true, message: 'done' }),
		};

		eventEmitter = {
			emit: jest.fn(),
		} as any;

		const configService = {
			getModuleConfig: jest.fn().mockReturnValue({ name: 'Buddy', maxToolIterations: 5 }),
		};

		service = new BuddyConversationService(
			conversationRepo as unknown as Repository<BuddyConversationEntity>,
			messageRepo as unknown as Repository<BuddyMessageEntity>,
			dataSource as unknown as OrmDataSource,
			llmProvider as unknown as LlmProviderService,
			contextService as unknown as BuddyContextService,
			personalityService as unknown as BuddyPersonalityService,
			toolProviderRegistry as unknown as ToolProviderRegistryService,
			eventEmitter,
			new ShortIdMappingService(),
			configService as unknown as ConfigService,
		);
	});

	describe('findAll', () => {
		it('should return all conversations when no spaceId filter', async () => {
			const result = await service.findAll();

			expect(result).toHaveLength(1);
			expect(conversationRepo.find).toHaveBeenCalledWith({ where: undefined, order: { updatedAt: 'DESC' } });
		});

		it('should filter conversations by spaceId when provided', async () => {
			await service.findAll('space-1');

			expect(conversationRepo.find).toHaveBeenCalledWith({
				where: { spaceId: 'space-1' },
				order: { updatedAt: 'DESC' },
			});
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
			expect(result.metadata).toEqual(
				expect.objectContaining({
					provider: 'buddy-claude-plugin',
					model: 'claude-sonnet-4-20250514',
					inputTokens: 100,
					outputTokens: 50,
				}),
			);
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
				expect.objectContaining({}),
			);
		});

		it('should format energy values with kW units and omit battery when absent', async () => {
			contextService.buildContext.mockResolvedValue({
				timestamp: new Date().toISOString(),
				timezone: 'Europe/Prague',
				spaces: [],
				devices: [],
				scenes: [],
				weather: null,
				energy: { solarProduction: 3.5, gridConsumption: 1.2, gridExport: 2.3 },
				recentIntents: [],
			});

			await service.sendMessage('conv-1', 'Tell me about energy');

			const systemPrompt = llmProvider.sendMessage.mock.calls[0][0] as string;

			expect(systemPrompt).toContain('Solar production: 3.5 kW');
			expect(systemPrompt).toContain('Grid consumption: 1.2 kW');
			expect(systemPrompt).toContain('Grid export: 2.3 kW');
			expect(systemPrompt).not.toContain('Battery');
			expect(systemPrompt).not.toContain('null');
		});

		it('should include battery level in energy section when present', async () => {
			contextService.buildContext.mockResolvedValue({
				timestamp: new Date().toISOString(),
				timezone: 'Europe/Prague',
				spaces: [],
				devices: [],
				scenes: [],
				weather: null,
				energy: { solarProduction: 3.5, gridConsumption: 1.2, gridExport: 2.3, batteryLevel: 85 },
				recentIntents: [],
			});

			await service.sendMessage('conv-1', 'Tell me about energy');

			const systemPrompt = llmProvider.sendMessage.mock.calls[0][0] as string;

			expect(systemPrompt).toContain('Battery level: 85%');
		});

		it('should render enriched weather in system prompt', async () => {
			contextService.buildContext.mockResolvedValue({
				timestamp: new Date().toISOString(),
				timezone: 'Europe/Prague',
				spaces: [],
				devices: [],
				scenes: [],
				weather: {
					current: {
						temperature: 22.5,
						feelsLike: 21.0,
						conditions: 'partly cloudy',
						humidity: 55,
						pressure: 1013,
						wind: { speed: 3.5, deg: 250, gust: 5.2 },
						clouds: 40,
						rain: null,
						snow: null,
						sunrise: '2025-01-16T07:15:00.000Z',
						sunset: '2025-01-16T16:30:00.000Z',
					},
					forecast: [],
					alerts: [],
				},
				energy: null,
				recentIntents: [],
			});

			await service.sendMessage('conv-1', 'Weather?');

			const systemPrompt = llmProvider.sendMessage.mock.calls[0][0] as string;

			expect(systemPrompt).toContain('Temperature: 22.5°C (feels like 21°C)');
			expect(systemPrompt).toContain('Conditions: partly cloudy, Clouds: 40%');
			expect(systemPrompt).toContain('Humidity: 55%, Pressure: 1013 hPa');
			expect(systemPrompt).toContain('Wind: 3.5 m/s (gusts 5.2 m/s)');
			expect(systemPrompt).not.toContain('Rain:');
			expect(systemPrompt).toContain('Sunrise:');
			expect(systemPrompt).toContain('Sunset:');
		});

		it('should render weather forecast in system prompt', async () => {
			contextService.buildContext.mockResolvedValue({
				timestamp: new Date().toISOString(),
				timezone: 'Europe/Prague',
				spaces: [],
				devices: [],
				scenes: [],
				weather: {
					current: {
						temperature: 22.5,
						feelsLike: 21.0,
						conditions: 'partly cloudy',
						humidity: 55,
						pressure: 1013,
						wind: { speed: 3.5, deg: 250, gust: null },
						clouds: 40,
						rain: null,
						snow: null,
						sunrise: '2025-01-16T07:15:00.000Z',
						sunset: '2025-01-16T16:30:00.000Z',
					},
					forecast: [
						{
							date: '2025-01-17T12:00:00.000Z',
							tempDay: 12,
							tempMin: 8,
							tempMax: 15,
							conditions: 'partly cloudy',
							humidity: 60,
							wind: 4.2,
							rain: null,
							snow: null,
						},
					],
					alerts: [],
				},
				energy: null,
				recentIntents: [],
			});

			await service.sendMessage('conv-1', 'Forecast?');

			const systemPrompt = llmProvider.sendMessage.mock.calls[0][0] as string;

			expect(systemPrompt).toContain('## Weather Forecast');
			expect(systemPrompt).toContain('8–15°C');
			expect(systemPrompt).toContain('wind 4.2 m/s');
			expect(systemPrompt).toContain('humidity 60%');
		});

		it('should render weather alerts in system prompt', async () => {
			contextService.buildContext.mockResolvedValue({
				timestamp: new Date().toISOString(),
				timezone: 'Europe/Prague',
				spaces: [],
				devices: [],
				scenes: [],
				weather: {
					current: {
						temperature: 22.5,
						feelsLike: 21.0,
						conditions: 'clear',
						humidity: 55,
						pressure: 1013,
						wind: { speed: 3.5, deg: 250, gust: null },
						clouds: 0,
						rain: null,
						snow: null,
						sunrise: '2025-01-16T07:15:00.000Z',
						sunset: '2025-01-16T16:30:00.000Z',
					},
					forecast: [],
					alerts: [
						{
							event: 'Heat Advisory',
							start: '2025-01-16T12:00:00.000Z',
							end: '2025-01-17T00:00:00.000Z',
							description: 'High temperatures expected',
						},
					],
				},
				energy: null,
				recentIntents: [],
			});

			await service.sendMessage('conv-1', 'Any alerts?');

			const systemPrompt = llmProvider.sendMessage.mock.calls[0][0] as string;

			expect(systemPrompt).toContain('## Weather Alerts');
			expect(systemPrompt).toContain('Heat Advisory');
			expect(systemPrompt).toContain('High temperatures expected');
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

			await expect(service.sendMessage('nonexistent', 'Hello')).rejects.toThrow(BuddyConversationNotFoundException);
		});

		it('should propagate BuddyProviderNotConfiguredException from LLM provider', async () => {
			llmProvider.sendMessage.mockRejectedValue(new BuddyProviderNotConfiguredException());

			await expect(service.sendMessage('conv-1', 'Hello')).rejects.toThrow(BuddyProviderNotConfiguredException);
		});

		it('should load recent message history for LLM context', async () => {
			// Messages are loaded in DESC order and then reversed
			const previousMessages: Partial<BuddyMessageEntity>[] = [
				{ role: MessageRole.ASSISTANT, content: 'Previous answer' },
				{ role: MessageRole.USER, content: 'Previous question' },
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
				expect.objectContaining({}),
			);
		});

		it('should use atomic title update with WHERE title IS NULL', async () => {
			let capturedManager: Record<string, jest.Mock> | undefined;

			dataSource.transaction.mockImplementation(
				async (fn: (manager: Record<string, jest.Mock>) => Promise<unknown>) => {
					const mockQueryBuilder = {
						update: jest.fn().mockReturnThis(),
						set: jest.fn().mockReturnThis(),
						where: jest.fn().mockReturnThis(),
						execute: jest.fn().mockResolvedValue({ affected: 1 }),
					};

					const manager = {
						create: jest.fn(
							(_Entity: unknown, data: Partial<BuddyMessageEntity>) => ({ ...data }) as BuddyMessageEntity,
						),
						save: jest.fn((entity: BuddyMessageEntity) => Promise.resolve(entity)),
						update: jest.fn().mockResolvedValue(undefined),
						createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
					};

					capturedManager = manager;

					return fn(manager);
				},
			);

			await service.sendMessage('conv-1', 'First message');

			expect(capturedManager?.createQueryBuilder).toHaveBeenCalled();

			const qb = capturedManager?.createQueryBuilder.mock.results[0].value;

			expect(qb.where).toHaveBeenCalledWith('id = :id AND title IS NULL', { id: 'conv-1' });
		});
	});

	describe('sendMessage - prompt truncation', () => {
		it('should include all devices for a small home (no truncation)', async () => {
			const devices = generateDevices(5);

			contextService.buildContext.mockResolvedValue({
				timestamp: new Date().toISOString(),
				timezone: 'Europe/Prague',
				spaces: [{ id: 'space-1', name: 'Living Room', category: 'room', deviceCount: 5 }],
				devices,
				scenes: [],
				weather: null,
				energy: null,
				recentIntents: [],
			});

			await service.sendMessage('conv-1', 'Status?');

			const systemPrompt = llmProvider.sendMessage.mock.calls[0][0] as string;

			// All 5 devices should be listed
			for (const device of devices) {
				expect(systemPrompt).toContain(device.name);
			}

			// No truncation note
			expect(systemPrompt).not.toContain('omitted for brevity');
		});

		it('should truncate devices for a large global conversation', async () => {
			// Global conversation (spaceId=null) with 100 devices across two spaces
			// exceeds the 8k * 0.8 = 6.4k token budget
			const space1Devices = generateDevices(10, 'space-1');
			const space2Devices = generateDevices(90, 'space-2');
			const allDevices = [...space1Devices, ...space2Devices];

			contextService.buildContext.mockResolvedValue({
				timestamp: new Date().toISOString(),
				timezone: 'Europe/Prague',
				spaces: [
					{ id: 'space-1', name: 'Living Room', category: 'room', deviceCount: 10 },
					{ id: 'space-2', name: 'Garage', category: 'room', deviceCount: 90 },
				],
				devices: allDevices,
				scenes: [],
				weather: null,
				energy: null,
				recentIntents: [],
			});

			llmProvider.supportsTools.mockReturnValue(true);

			await service.sendMessage('conv-1', 'What is the temperature?');

			const systemPrompt = llmProvider.sendMessage.mock.calls[0][0] as string;

			// Should include truncation notice
			expect(systemPrompt).toContain('omitted for brevity');

			// The prompt should be within a reasonable size
			const estimatedTokens = Math.ceil(systemPrompt.length / 4);

			expect(estimatedTokens).toBeLessThan(8_000);
		});

		it('should prioritize current space devices for a scoped conversation', async () => {
			// Scoped conversation with spaceId='space-1' — current space devices
			// should get full detail, while other spaces are summarized
			const scopedConversation: BuddyConversationEntity = {
				id: 'conv-scoped',
				title: 'Living Room Chat',
				spaceId: 'space-1',
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			conversationRepo.findOne.mockResolvedValue(scopedConversation);

			const currentDevices = generateDevices(5, 'space-1');
			const otherDevices = generateDevices(80, 'space-2');
			const allDevices = [...currentDevices, ...otherDevices];

			contextService.buildContext.mockResolvedValue({
				timestamp: new Date().toISOString(),
				timezone: 'Europe/Prague',
				spaces: [
					{ id: 'space-1', name: 'Living Room', category: 'room', deviceCount: 5 },
					{ id: 'space-2', name: 'Garage', category: 'room', deviceCount: 80 },
				],
				devices: allDevices,
				scenes: [],
				weather: null,
				energy: null,
				recentIntents: [],
			});

			llmProvider.supportsTools.mockReturnValue(true);

			await service.sendMessage('conv-scoped', 'What is the temperature?');

			const systemPrompt = llmProvider.sendMessage.mock.calls[0][0] as string;

			// Current space (Living Room) devices should have full detail with property IDs
			for (const device of currentDevices) {
				expect(systemPrompt).toContain(device.name);
			}

			// Other space should be summarized, not listed device-by-device
			expect(systemPrompt).toContain('Garage');
			expect(systemPrompt).toContain('ask for details');
			expect(systemPrompt).toContain('omitted for brevity');

			// Prompt should stay within budget
			const estimatedTokens = Math.ceil(systemPrompt.length / 4);

			expect(estimatedTokens).toBeLessThan(8_000);
		});

		it('should aggressively truncate for a very large home', async () => {
			// Generate 200 devices — far beyond budget, global conversation
			const allDevices = generateDevices(200, 'space-other');
			const spaces = [
				{ id: 'space-1', name: 'Master Bedroom', category: 'room', deviceCount: 5 },
				{ id: 'space-other', name: 'Whole House', category: 'zone', deviceCount: 200 },
			];

			contextService.buildContext.mockResolvedValue({
				timestamp: new Date().toISOString(),
				timezone: 'Europe/Prague',
				spaces,
				devices: allDevices,
				scenes: [],
				weather: null,
				energy: null,
				recentIntents: [],
			});

			llmProvider.supportsTools.mockReturnValue(true);

			await service.sendMessage('conv-1', 'Overview');

			const systemPrompt = llmProvider.sendMessage.mock.calls[0][0] as string;

			// Should have truncation note
			expect(systemPrompt).toContain('omitted for brevity');
			// Should still have the Devices section
			expect(systemPrompt).toContain('## Devices');
			// Prompt should stay within budget
			const estimatedTokens = Math.ceil(systemPrompt.length / 4);

			expect(estimatedTokens).toBeLessThan(8_000);
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
