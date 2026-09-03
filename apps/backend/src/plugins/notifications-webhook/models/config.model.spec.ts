import { validateSync } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigSecretField } from '../../../modules/config/interfaces/config-secret.interface';
import { ConfigSecretsService } from '../../../modules/config/services/config-secrets.service';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';

import { NotificationsWebhookConfigModel } from './config.model';

const SECRET_FIELDS: ConfigSecretField[] = [
	{ path: 'url', configuredPath: 'url_configured', inputPaths: ['url'] },
	{ path: 'headers', configuredPath: 'headers_configured', inputPaths: ['headers'] },
];

// `excludeExtraneousValues: false` matches how `ConfigService.getPluginConfig()` actually
// calls `toInstance()` in production - without it, `toInstance()`'s own default combination
// of `enableImplicitConversion` and `excludeExtraneousValues` silently empties a plain
// object property (like `headers`) that carries no `@Type()` decorator, which would make
// every assertion below pass against `{}` regardless of what `headers` was actually set to.
const build = (plain: Record<string, unknown>): NotificationsWebhookConfigModel =>
	toInstance(
		NotificationsWebhookConfigModel,
		{
			type: 'notifications-webhook-plugin',
			enabled: true,
			url: null,
			headers: null,
			min_severity: NotificationSeverity.WARNING,
			...plain,
		},
		{ excludeExtraneousValues: false },
	);

describe('NotificationsWebhookConfigModel', () => {
	describe('defaults', () => {
		it('defaults min_severity to warning', () => {
			const model = new NotificationsWebhookConfigModel();

			expect(model.minSeverity).toBe(NotificationSeverity.WARNING);
		});
	});

	describe('url validation', () => {
		it('accepts a null URL', () => {
			expect(validateSync(build({ url: null }))).toHaveLength(0);
		});

		it('accepts an https URL', () => {
			expect(validateSync(build({ url: 'https://example.com/hooks/panel' }))).toHaveLength(0);
		});

		it('accepts an http URL when no headers are configured', () => {
			expect(validateSync(build({ url: 'http://n8n.local/webhook/panel' }))).toHaveLength(0);
		});

		it('rejects a non-URL string', () => {
			expect(validateSync(build({ url: 'not-a-url' }))).not.toHaveLength(0);
		});

		it('rejects a non-HTTP(S) scheme', () => {
			expect(validateSync(build({ url: 'ftp://example.com/hooks/panel' }))).not.toHaveLength(0);
		});
	});

	describe('headers require HTTPS', () => {
		it('rejects an http: URL combined with custom headers', () => {
			const errors = validateSync(
				build({ url: 'http://n8n.local/webhook/panel', headers: { Authorization: 'Bearer token' } }),
			);

			expect(errors).not.toHaveLength(0);
			expect(JSON.stringify(errors)).toContain('Custom headers require an HTTPS webhook URL');
		});

		it('accepts an https: URL combined with custom headers', () => {
			const errors = validateSync(
				build({ url: 'https://example.com/hooks/panel', headers: { Authorization: 'Bearer token' } }),
			);

			expect(errors).toHaveLength(0);
		});

		it('accepts null headers regardless of scheme', () => {
			expect(validateSync(build({ url: 'http://n8n.local/webhook/panel', headers: null }))).toHaveLength(0);
		});
	});

	describe('headers shape validation', () => {
		it('rejects a non-string header value', () => {
			const errors = validateSync(build({ url: 'https://example.com/hooks/panel', headers: { 'X-Retry': 1 } }));

			expect(errors).not.toHaveLength(0);
		});

		it('rejects an invalid HTTP header name', () => {
			const errors = validateSync(
				build({ url: 'https://example.com/hooks/panel', headers: { 'bad header': 'value' } }),
			);

			expect(errors).not.toHaveLength(0);
		});

		it('accepts a well-formed header record', () => {
			const errors = validateSync(
				build({ url: 'https://example.com/hooks/panel', headers: { 'X-Custom-Header': '1' } }),
			);

			expect(errors).toHaveLength(0);
		});
	});

	describe('redaction through ConfigSecretsService.toPublic', () => {
		it('strips the URL and headers, and adds the _configured siblings', () => {
			const secrets = new ConfigSecretsService();
			const model = build({
				url: 'https://example.com/hooks/panel',
				headers: { Authorization: 'Bearer token' },
			});

			const publicConfig = secrets.toPublic(model, SECRET_FIELDS) as unknown as Record<string, unknown>;

			expect(publicConfig.url).toBeUndefined();
			expect(publicConfig.headers).toBeUndefined();
			expect(publicConfig.url_configured).toBe(true);
			expect(publicConfig.headers_configured).toBe(true);
		});

		it('reports url_configured and headers_configured as false when unset', () => {
			const secrets = new ConfigSecretsService();
			const model = build({ url: null, headers: null });

			const publicConfig = secrets.toPublic(model, SECRET_FIELDS) as unknown as Record<string, unknown>;

			expect(publicConfig.url_configured).toBe(false);
			expect(publicConfig.headers_configured).toBe(false);
		});
	});
});
