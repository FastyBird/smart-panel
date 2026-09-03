import { validateSync } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigSecretField } from '../../../modules/config/interfaces/config-secret.interface';
import { ConfigSecretsService } from '../../../modules/config/services/config-secrets.service';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';

import { NotificationsTelegramConfigModel } from './config.model';

const SECRET_FIELDS: ConfigSecretField[] = [
	{ path: 'bot_token', configuredPath: 'bot_token_configured', inputPaths: ['botToken'] },
];

const build = (plain: Record<string, unknown>): NotificationsTelegramConfigModel =>
	toInstance(NotificationsTelegramConfigModel, {
		type: 'notifications-telegram-plugin',
		enabled: true,
		bot_token: null,
		chat_id: null,
		min_severity: NotificationSeverity.WARNING,
		...plain,
	});

describe('NotificationsTelegramConfigModel', () => {
	describe('defaults', () => {
		it('defaults min_severity to warning', () => {
			const model = new NotificationsTelegramConfigModel();

			expect(model.minSeverity).toBe(NotificationSeverity.WARNING);
		});
	});

	describe('bot_token validation', () => {
		it('accepts a null bot token', () => {
			expect(validateSync(build({ bot_token: null }))).toHaveLength(0);
		});

		it('accepts a non-empty bot token', () => {
			expect(validateSync(build({ bot_token: '123456:ABC-token' }))).toHaveLength(0);
		});
	});

	describe('chat_id', () => {
		it('accepts a null chat id', () => {
			expect(validateSync(build({ chat_id: null }))).toHaveLength(0);
		});

		it('accepts a numeric chat id string', () => {
			expect(validateSync(build({ chat_id: '123456789' }))).toHaveLength(0);
		});

		it('accepts an @channel-style chat id', () => {
			expect(validateSync(build({ chat_id: '@my_channel' }))).toHaveLength(0);
		});
	});

	describe('redaction through ConfigSecretsService.toPublic', () => {
		it('strips the bot token and adds bot_token_configured', () => {
			const secrets = new ConfigSecretsService();
			const model = build({ bot_token: '123456:ABC-token' });

			const publicConfig = secrets.toPublic(model, SECRET_FIELDS) as unknown as Record<string, unknown>;

			expect(publicConfig.bot_token).toBeUndefined();
			expect(publicConfig.bot_token_configured).toBe(true);
		});

		it('reports bot_token_configured as false when unset', () => {
			const secrets = new ConfigSecretsService();
			const model = build({ bot_token: null });

			const publicConfig = secrets.toPublic(model, SECRET_FIELDS) as unknown as Record<string, unknown>;

			expect(publicConfig.bot_token_configured).toBe(false);
		});

		it('does not redact chat_id, which is not a secret', () => {
			const secrets = new ConfigSecretsService();
			const model = build({ chat_id: '123456789' });

			const publicConfig = secrets.toPublic(model, SECRET_FIELDS) as unknown as Record<string, unknown>;

			expect(publicConfig.chat_id).toBe('123456789');
		});
	});
});
