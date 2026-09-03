import { Test, TestingModule } from '@nestjs/testing';

import { NotificationEntity } from '../entities/notifications.entity';
import { NotificationSeverity } from '../notifications.constants';
import { INotificationChannel } from '../platforms/notification-channel.platform';

import { NotificationChannelRegistryService } from './notification-channel-registry.service';

describe('NotificationChannelRegistryService', () => {
	let service: NotificationChannelRegistryService;

	const fakeChannel = (type: string): INotificationChannel => ({
		getType: () => type,
		isConfigured: () => Promise.resolve(true),
		getMinSeverity: () => Promise.resolve(NotificationSeverity.WARNING),
		send: (_notification: NotificationEntity, _signal: AbortSignal) => Promise.resolve(),
	});

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [NotificationChannelRegistryService],
		}).compile();

		service = module.get(NotificationChannelRegistryService);
	});

	describe('register', () => {
		it('adds the channel so it is returned by getChannels', () => {
			const channel = fakeChannel('notifications-webhook-plugin');

			service.register(channel);

			expect(service.getChannels()).toEqual([channel]);
		});

		it('throws on a duplicate type', () => {
			service.register(fakeChannel('notifications-webhook-plugin'));

			expect(() => service.register(fakeChannel('notifications-webhook-plugin'))).toThrow(
				'Notification channel "notifications-webhook-plugin" is already registered.',
			);
		});

		it('allows the same type again once it has been unregistered', () => {
			const first = fakeChannel('notifications-webhook-plugin');

			service.register(first);
			service.unregister('notifications-webhook-plugin');

			const second = fakeChannel('notifications-webhook-plugin');

			expect(() => service.register(second)).not.toThrow();
			expect(service.getChannels()).toEqual([second]);
		});
	});

	describe('unregister', () => {
		it('is a no-op for a type that was never registered', () => {
			expect(() => service.unregister('never-registered-plugin')).not.toThrow();
			expect(service.getChannels()).toEqual([]);
		});
	});

	describe('getChannels', () => {
		it('returns every registered channel', () => {
			const webhook = fakeChannel('notifications-webhook-plugin');
			const discord = fakeChannel('notifications-discord-plugin');

			service.register(webhook);
			service.register(discord);

			expect(service.getChannels()).toEqual([webhook, discord]);
		});

		it('returns an empty array when nothing is registered', () => {
			expect(service.getChannels()).toEqual([]);
		});
	});

	describe('isChannel', () => {
		it('is true for a registered channel type - the dispatcher loop guard', () => {
			service.register(fakeChannel('notifications-webhook-plugin'));

			expect(service.isChannel('notifications-webhook-plugin')).toBe(true);
		});

		it('is false for a source that is not a registered channel', () => {
			expect(service.isChannel('home-assistant-plugin')).toBe(false);
		});
	});
});
