import { validateSync } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigSecretField } from '../../../modules/config/interfaces/config-secret.interface';
import { ConfigSecretsService } from '../../../modules/config/services/config-secrets.service';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';

import { NotificationsDiscordConfigModel } from './config.model';

const SECRET_FIELDS: ConfigSecretField[] = [
	{ path: 'webhook_url', configuredPath: 'webhook_url_configured', inputPaths: ['webhookUrl'] },
];

const build = (plain: Record<string, unknown>): NotificationsDiscordConfigModel =>
	toInstance(NotificationsDiscordConfigModel, {
		type: 'notifications-discord-plugin',
		enabled: true,
		webhook_url: null,
		username: null,
		min_severity: NotificationSeverity.WARNING,
		...plain,
	});

describe('NotificationsDiscordConfigModel', () => {
	describe('defaults', () => {
		it('defaults min_severity to warning', () => {
			const model = new NotificationsDiscordConfigModel();

			expect(model.minSeverity).toBe(NotificationSeverity.WARNING);
		});
	});

	describe('webhook_url validation', () => {
		it('accepts a null webhook URL', () => {
			expect(validateSync(build({ webhook_url: null }))).toHaveLength(0);
		});

		it('accepts an https webhook URL', () => {
			expect(validateSync(build({ webhook_url: 'https://discord.com/api/webhooks/1/token' }))).toHaveLength(0);
		});

		it('rejects an http webhook URL', () => {
			expect(validateSync(build({ webhook_url: 'http://discord.com/api/webhooks/1/token' }))).not.toHaveLength(0);
		});

		it('rejects a non-URL string', () => {
			expect(validateSync(build({ webhook_url: 'not-a-url' }))).not.toHaveLength(0);
		});
	});

	describe('redaction through ConfigSecretsService.toPublic', () => {
		it('strips the webhook URL and adds webhook_url_configured', () => {
			const secrets = new ConfigSecretsService();
			const model = build({ webhook_url: 'https://discord.com/api/webhooks/1/token' });

			const publicConfig = secrets.toPublic(model, SECRET_FIELDS) as unknown as Record<string, unknown>;

			expect(publicConfig.webhook_url).toBeUndefined();
			expect(publicConfig.webhook_url_configured).toBe(true);
		});

		it('reports webhook_url_configured as false when unset', () => {
			const secrets = new ConfigSecretsService();
			const model = build({ webhook_url: null });

			const publicConfig = secrets.toPublic(model, SECRET_FIELDS) as unknown as Record<string, unknown>;

			expect(publicConfig.webhook_url_configured).toBe(false);
		});
	});
});
