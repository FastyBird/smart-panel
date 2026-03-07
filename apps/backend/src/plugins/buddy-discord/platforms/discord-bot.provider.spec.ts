import { SuggestionType } from '../../../modules/buddy/buddy.constants';
import { BuddySuggestion } from '../../../modules/buddy/services/suggestion-engine.service';
import { BUDDY_DISCORD_PLUGIN_NAME } from '../buddy-discord.constants';
import { BuddyDiscordConfigModel } from '../models/config.model';

import { DiscordBotProvider } from './discord-bot.provider';

function makeConfig(overrides: Partial<BuddyDiscordConfigModel> = {}): BuddyDiscordConfigModel {
	return Object.assign(new BuddyDiscordConfigModel(), {
		type: BUDDY_DISCORD_PLUGIN_NAME,
		enabled: false,
		botToken: null,
		guildId: null,
		generalChannelId: null,
		spaceChannelMappings: null,
		allowedRoleId: null,
		...overrides,
	});
}

function makeSuggestion(overrides: Partial<BuddySuggestion> = {}): BuddySuggestion {
	return {
		id: 'sug-1',
		type: SuggestionType.CONFLICT_HEATING_WINDOW,
		title: 'Heating conflict',
		reason: 'Living room window is open but heating is active.',
		spaceId: 'space-1',
		metadata: {},
		createdAt: new Date(),
		expiresAt: new Date(Date.now() + 86_400_000),
		...overrides,
	};
}

describe('DiscordBotProvider', () => {
	let provider: DiscordBotProvider;
	let configService: { getPluginConfig: jest.Mock };
	let conversationService: {
		findOne: jest.Mock;
		create: jest.Mock;
		sendMessage: jest.Mock;
	};
	let suggestionEngine: { recordFeedback: jest.Mock };

	beforeEach(() => {
		configService = {
			getPluginConfig: jest.fn().mockReturnValue(makeConfig()),
		};

		conversationService = {
			findOne: jest.fn().mockResolvedValue(null),
			create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
			sendMessage: jest.fn().mockResolvedValue({ content: 'Hello from buddy!' }),
		};

		suggestionEngine = {
			recordFeedback: jest.fn().mockReturnValue({ success: true }),
		};

		provider = new DiscordBotProvider(
			configService as unknown as ConstructorParameters<typeof DiscordBotProvider>[0],
			conversationService as unknown as ConstructorParameters<typeof DiscordBotProvider>[1],
			suggestionEngine as unknown as ConstructorParameters<typeof DiscordBotProvider>[2],
		);
	});

	afterEach(async () => {
		await provider.onModuleDestroy();
	});

	describe('onApplicationBootstrap', () => {
		it('should not start bot when plugin is disabled', () => {
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: false }));

			provider.onApplicationBootstrap();

			expect(provider.isRunning()).toBe(false);
		});

		it('should not start bot when token is missing', () => {
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: true, botToken: null }));

			provider.onApplicationBootstrap();

			expect(provider.isRunning()).toBe(false);
		});
	});

	describe('onConfigUpdated', () => {
		it('should stop bot when plugin is disabled on config update', async () => {
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: false }));

			await provider.onConfigUpdated();

			expect(provider.isRunning()).toBe(false);
		});

		it('should not restart bot when unrelated config changes', async () => {
			// First init with disabled config (sets activeConfig snapshot)
			configService.getPluginConfig.mockReturnValue(makeConfig({ enabled: false }));
			await provider.onConfigUpdated();

			// Simulate unrelated config change — same discord config returned
			const stopSpy = jest.spyOn(provider as never, 'stopBot' as never);

			await provider.onConfigUpdated();

			// stopBot should not be called because config hasn't changed
			expect(stopSpy).not.toHaveBeenCalled();

			stopSpy.mockRestore();
		});
	});

	describe('onSuggestionCreated', () => {
		it('should not throw when bot is not running', async () => {
			const suggestion = makeSuggestion();

			await expect(provider.onSuggestionCreated(suggestion)).resolves.not.toThrow();
		});
	});

	describe('getPluginConfig fallback', () => {
		it('should return null when config service throws', () => {
			configService.getPluginConfig.mockImplementation(() => {
				throw new Error('Config not found');
			});

			// Should not throw - falls back to null config, bot stays stopped
			provider.onApplicationBootstrap();

			expect(provider.isRunning()).toBe(false);
		});
	});

	describe('splitMessage', () => {
		it('should not split messages under the limit', () => {
			const result = provider.splitMessage('Hello world');

			expect(result).toEqual(['Hello world']);
		});

		it('should split long messages at newlines', () => {
			const longText = 'A'.repeat(1900) + '\n' + 'B'.repeat(200);
			const result = provider.splitMessage(longText);

			expect(result.length).toBe(2);
			expect(result[0]).toBe('A'.repeat(1900));
			expect(result[1]).toBe('B'.repeat(200));
		});
	});

	describe('parseSpaceChannelMappings', () => {
		it('should parse valid JSON mappings', () => {
			const result = provider.parseSpaceChannelMappings('{"space-1":"chan-1","space-2":"chan-2"}');

			expect(result).toEqual({ 'space-1': 'chan-1', 'space-2': 'chan-2' });
		});

		it('should return empty object for null/empty', () => {
			expect(provider.parseSpaceChannelMappings(null)).toEqual({});
			expect(provider.parseSpaceChannelMappings('')).toEqual({});
		});

		it('should return empty object for invalid JSON', () => {
			expect(provider.parseSpaceChannelMappings('not-json')).toEqual({});
		});

		it('should return empty object for non-object JSON', () => {
			expect(provider.parseSpaceChannelMappings('[]')).toEqual({});
			expect(provider.parseSpaceChannelMappings('"string"')).toEqual({});
		});
	});

	describe('getSpaceForChannel', () => {
		it('should return the space ID for a mapped channel', () => {
			const config = makeConfig({ spaceChannelMappings: '{"space-1":"chan-1","space-2":"chan-2"}' });
			const result = provider.getSpaceForChannel(config, 'chan-1');

			expect(result).toBe('space-1');
		});

		it('should return null for an unmapped channel', () => {
			const config = makeConfig({ spaceChannelMappings: '{"space-1":"chan-1"}' });
			const result = provider.getSpaceForChannel(config, 'chan-unknown');

			expect(result).toBeNull();
		});
	});

	describe('getChannelForSpace', () => {
		it('should return the channel ID for a mapped space', () => {
			const config = makeConfig({ spaceChannelMappings: '{"space-1":"chan-1"}' });
			const result = provider.getChannelForSpace(config, 'space-1');

			expect(result).toBe('chan-1');
		});

		it('should return null for an unmapped space', () => {
			const config = makeConfig({ spaceChannelMappings: '{"space-1":"chan-1"}' });
			const result = provider.getChannelForSpace(config, 'space-unknown');

			expect(result).toBeNull();
		});
	});

	describe('getAllowedChannelIds', () => {
		it('should include general channel and mapped channels', () => {
			const config = makeConfig({
				generalChannelId: 'general-chan',
				spaceChannelMappings: '{"space-1":"chan-1","space-2":"chan-2"}',
			});
			const result = provider.getAllowedChannelIds(config);

			expect(result).toEqual(new Set(['general-chan', 'chan-1', 'chan-2']));
		});

		it('should return empty set when no channels configured', () => {
			const config = makeConfig();
			const result = provider.getAllowedChannelIds(config);

			expect(result).toEqual(new Set());
		});
	});
});
