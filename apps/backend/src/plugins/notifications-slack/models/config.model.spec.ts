import { validateSync } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigSecretField } from '../../../modules/config/interfaces/config-secret.interface';
import { ConfigSecretsService } from '../../../modules/config/services/config-secrets.service';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';

import { NotificationsSlackConfigModel } from './config.model';

const SECRET_FIELDS: ConfigSecretField[] = [
	{ path: 'webhook_url', configuredPath: 'webhook_url_configured', inputPaths: ['webhookUrl'] },
];

const build = (plain: Record<string, unknown>): NotificationsSlackConfigModel =>
	toInstance(NotificationsSlackConfigModel, {
		type: 'notifications-slack-plugin',
		enabled: true,
		webhook_url: null,
		min_severity: NotificationSeverity.WARNING,
		...plain,
	});

describe('NotificationsSlackConfigModel', () => {
	describe('defaults', () => {
		it('defaults min_severity to warning', () => {
			const model = new NotificationsSlackConfigModel();

			expect(model.minSeverity).toBe(NotificationSeverity.WARNING);
		});
	});

	describe('webhook_url validation', () => {
		it('accepts a null webhook URL', () => {
			expect(validateSync(build({ webhook_url: null }))).toHaveLength(0);
		});

		it('accepts an https webhook URL', () => {
			expect(validateSync(build({ webhook_url: 'https://hooks.slack.com/services/T0/B0/XYZ' }))).toHaveLength(0);
		});

		it('rejects an http webhook URL', () => {
			expect(validateSync(build({ webhook_url: 'http://hooks.slack.com/services/T0/B0/XYZ' }))).not.toHaveLength(0);
		});

		it('rejects a non-URL string', () => {
			expect(validateSync(build({ webhook_url: 'not-a-url' }))).not.toHaveLength(0);
		});
	});

	describe('redaction through ConfigSecretsService.toPublic', () => {
		it('strips the webhook URL and adds webhook_url_configured', () => {
			const secrets = new ConfigSecretsService();
			const model = build({ webhook_url: 'https://hooks.slack.com/services/T0/B0/XYZ' });

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
