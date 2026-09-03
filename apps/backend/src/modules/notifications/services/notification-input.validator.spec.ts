import { Test, TestingModule } from '@nestjs/testing';

import {
	NOTIFICATION_MESSAGE_MAX_LENGTH,
	NOTIFICATION_TITLE_MAX_LENGTH,
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../notifications.constants';

import { NotificationInputValidator } from './notification-input.validator';
import { CreateNotificationInput } from './notifications.service';

describe('NotificationInputValidator', () => {
	let validator: NotificationInputValidator;

	const baseInput = (overrides: Partial<CreateNotificationInput> = {}): CreateNotificationInput => ({
		source: 'system-module',
		kind: NotificationKind.EVENT,
		severity: NotificationSeverity.INFO,
		title: 'Something happened',
		...overrides,
	});

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [NotificationInputValidator],
		}).compile();

		validator = module.get(NotificationInputValidator);
	});

	describe('normalisation', () => {
		it('fills the optional fields of a minimal event', () => {
			const result = validator.validate(baseInput());

			expect(result).toEqual({
				outcome: 'accepted',
				value: {
					source: 'system-module',
					kind: NotificationKind.EVENT,
					key: null,
					severity: NotificationSeverity.INFO,
					title: 'Something happened',
					message: null,
					actions: [],
					data: null,
					persistent: false,
				},
			});
		});

		it('keeps an event key and forces persistent off for events', () => {
			const result = validator.validate(baseInput({ key: 'login-failed:admin', persistent: true }));

			expect(result.outcome).toBe('accepted');
			expect(result.outcome === 'accepted' && result.value.key).toBe('login-failed:admin');
			expect(result.outcome === 'accepted' && result.value.persistent).toBe(false);
		});

		it('keeps persistent for issues', () => {
			const result = validator.validate(
				baseInput({ kind: NotificationKind.ISSUE, key: 'update-failed', persistent: true }),
			);

			expect(result.outcome === 'accepted' && result.value.persistent).toBe(true);
		});

		it('treats a blank key as absent', () => {
			const result = validator.validate(baseInput({ key: '   ' }));

			expect(result.outcome === 'accepted' && result.value.key).toBeNull();
		});
	});

	describe('truncation', () => {
		it('truncates the title to its limit', () => {
			const result = validator.validate(baseInput({ title: 'a'.repeat(NOTIFICATION_TITLE_MAX_LENGTH + 40) }));

			expect(result.outcome === 'accepted' && result.value.title).toHaveLength(NOTIFICATION_TITLE_MAX_LENGTH);
		});

		it('truncates the message to its limit', () => {
			const result = validator.validate(baseInput({ message: 'b'.repeat(NOTIFICATION_MESSAGE_MAX_LENGTH + 40) }));

			expect(result.outcome === 'accepted' && result.value.message).toHaveLength(NOTIFICATION_MESSAGE_MAX_LENGTH);
		});

		it('drops actions beyond the third', () => {
			const action = (label: string) => ({
				type: NotificationActionType.LINK as const,
				label,
				url: '/system/info',
			});

			const result = validator.validate(
				baseInput({ actions: [action('one'), action('two'), action('three'), action('four')] }),
			);

			expect(result.outcome === 'accepted' && result.value.actions.map((item) => item.label)).toEqual([
				'one',
				'two',
				'three',
			]);
		});

		it('does not reject because of an invalid fourth action, which is dropped first', () => {
			const result = validator.validate(
				baseInput({
					actions: [
						{ type: NotificationActionType.LINK, label: 'one', url: '/system/info' },
						{ type: NotificationActionType.LINK, label: 'two', url: '/system/info' },
						{ type: NotificationActionType.LINK, label: 'three', url: '/system/info' },
						{ type: NotificationActionType.LINK, label: 'four', url: 'javascript:alert(1)' },
					],
				}),
			);

			expect(result.outcome).toBe('accepted');
		});
	});

	describe('rejections', () => {
		it('rejects an issue without a key', () => {
			const result = validator.validate(baseInput({ kind: NotificationKind.ISSUE }));

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('key') as string });
		});

		it('rejects a blank source', () => {
			const result = validator.validate(baseInput({ source: '   ' }));

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('source') as string });
		});

		it('rejects an unknown severity', () => {
			const result = validator.validate(baseInput({ severity: 'catastrophic' as NotificationSeverity }));

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('severity') as string });
		});

		it('rejects an unknown kind', () => {
			const result = validator.validate(baseInput({ kind: 'reminder' as NotificationKind }));

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('kind') as string });
		});

		it('rejects an action with an unknown type', () => {
			const result = validator.validate(baseInput({ actions: [{ type: 'shell', label: 'Run' } as never] }));

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('type') as string });
		});

		it('rejects actions that are not an array, rather than throwing at the emitter', () => {
			const result = validator.validate(
				baseInput({ actions: { type: NotificationActionType.LINK, label: 'Open', url: '/system/info' } as never }),
			);

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('actions') as string });
		});

		it('rejects an action without a label', () => {
			const result = validator.validate(
				baseInput({ actions: [{ type: NotificationActionType.LINK, label: '', url: '/system/info' }] }),
			);

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('label') as string });
		});
	});

	describe('link actions', () => {
		it.each(['/system/info', 'http://example.com/status', 'https://example.com/status'])(
			'accepts the url %s',
			(url) => {
				const result = validator.validate(
					baseInput({ actions: [{ type: NotificationActionType.LINK, label: 'Open', url }] }),
				);

				expect(result.outcome).toBe('accepted');
			},
		);

		it.each(['javascript:alert(1)', 'data:text/html,<script></script>', 'file:///etc/passwd', '//evil.example.com'])(
			'rejects the url %s',
			(url) => {
				const result = validator.validate(
					baseInput({ actions: [{ type: NotificationActionType.LINK, label: 'Open', url }] }),
				);

				expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('url') as string });
			},
		);
	});

	describe('extension action and service actions', () => {
		it('accepts a complete extension action', () => {
			const result = validator.validate(
				baseInput({
					actions: [
						{
							type: NotificationActionType.EXTENSION_ACTION,
							label: 'Reconnect',
							extension_type: 'devices-home-assistant-plugin',
							action_id: 'reconnect',
							params: { force: true },
							primary: true,
						},
					],
				}),
			);

			expect(result.outcome).toBe('accepted');
		});

		it('rejects an extension action without an action id', () => {
			const result = validator.validate(
				baseInput({
					actions: [
						{
							type: NotificationActionType.EXTENSION_ACTION,
							label: 'Reconnect',
							extension_type: 'devices-home-assistant-plugin',
							action_id: '',
						},
					],
				}),
			);

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('action_id') as string });
		});

		it('rejects extension action params that are not flat', () => {
			const result = validator.validate(
				baseInput({
					actions: [
						{
							type: NotificationActionType.EXTENSION_ACTION,
							label: 'Reconnect',
							extension_type: 'devices-home-assistant-plugin',
							action_id: 'reconnect',
							params: { nested: { deep: true } } as never,
						},
					],
				}),
			);

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('params') as string });
		});

		it('accepts a complete service action', () => {
			const result = validator.validate(
				baseInput({
					actions: [
						{
							type: NotificationActionType.SERVICE,
							label: 'Restart',
							extension_kind: 'plugin',
							extension_type: 'devices-home-assistant-plugin',
							service_id: 'home-assistant-ws',
							operation: 'restart',
						},
					],
				}),
			);

			expect(result.outcome).toBe('accepted');
		});

		it('rejects a service action with an unknown operation', () => {
			const result = validator.validate(
				baseInput({
					actions: [
						{
							type: NotificationActionType.SERVICE,
							label: 'Reload',
							extension_kind: 'plugin',
							extension_type: 'devices-home-assistant-plugin',
							service_id: 'home-assistant-ws',
							operation: 'reload' as never,
						},
					],
				}),
			);

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('operation') as string });
		});

		it('rejects a service action with an unknown extension kind', () => {
			const result = validator.validate(
				baseInput({
					actions: [
						{
							type: NotificationActionType.SERVICE,
							label: 'Restart',
							extension_kind: 'widget' as never,
							extension_type: 'devices-home-assistant-plugin',
							service_id: 'home-assistant-ws',
							operation: 'restart',
						},
					],
				}),
			);

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('extension_kind') as string });
		});
	});

	describe('data payload', () => {
		it('accepts a flat payload of primitives and nulls', () => {
			const result = validator.validate(
				baseInput({ data: { username: 'admin', attempts: 3, locked: false, reason: null } }),
			);

			expect(result.outcome === 'accepted' && result.value.data).toEqual({
				username: 'admin',
				attempts: 3,
				locked: false,
				reason: null,
			});
		});

		it('rejects a payload above the byte limit', () => {
			const result = validator.validate(baseInput({ data: { blob: 'x'.repeat(5000) } }));

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('data') as string });
		});

		it('rejects a nested payload', () => {
			const result = validator.validate(baseInput({ data: { nested: { deep: true } } as never }));

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('data') as string });
		});

		it('rejects a payload that is an array', () => {
			const result = validator.validate(baseInput({ data: ['one', 'two'] as never }));

			expect(result).toEqual({ outcome: 'rejected', reason: expect.stringContaining('data') as string });
		});
	});
});
