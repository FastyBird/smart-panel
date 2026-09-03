import { validateSync } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';

import { UpdateNotificationsWebhookConfigDto } from './update-config.dto';

const build = (plain: Record<string, unknown>): UpdateNotificationsWebhookConfigDto =>
	toInstance(
		UpdateNotificationsWebhookConfigDto,
		{ type: 'notifications-webhook-plugin', ...plain },
		{ excludeExtraneousValues: false },
	);

describe('UpdateNotificationsWebhookConfigDto', () => {
	describe('url', () => {
		it('reaches the DTO as null when submitted null', () => {
			expect(build({ url: null }).url).toBeNull();
		});

		it('is undefined when not submitted at all', () => {
			expect(build({}).url).toBeUndefined();
		});

		it('accepts a valid https URL', () => {
			expect(validateSync(build({ url: 'https://example.com/hooks/panel' }))).toHaveLength(0);
		});

		it('accepts a valid http URL', () => {
			expect(validateSync(build({ url: 'http://n8n.local/webhook/panel' }))).toHaveLength(0);
		});

		it('rejects a malformed URL', () => {
			expect(validateSync(build({ url: 'not-a-url' }))).not.toHaveLength(0);
		});
	});

	describe('headers', () => {
		it('reaches the DTO as null when submitted null', () => {
			expect(build({ headers: null }).headers).toBeNull();
		});

		it('is undefined when not submitted at all', () => {
			expect(build({}).headers).toBeUndefined();
		});

		it('accepts an object of header values', () => {
			expect(validateSync(build({ headers: { Authorization: 'Bearer token' } }))).toHaveLength(0);
		});

		it('rejects a non-object value', () => {
			expect(validateSync(build({ headers: 'not-an-object' }))).not.toHaveLength(0);
		});
	});

	describe('min_severity', () => {
		it('accepts a valid severity', () => {
			expect(validateSync(build({ min_severity: NotificationSeverity.CRITICAL }))).toHaveLength(0);
		});

		it('rejects an invalid severity', () => {
			expect(validateSync(build({ min_severity: 'not-a-severity' }))).not.toHaveLength(0);
		});

		it('treats an explicit null as unset rather than an invalid value', () => {
			const dto = build({ min_severity: null });

			expect(dto.minSeverity).toBeUndefined();
			expect(validateSync(dto)).toHaveLength(0);
		});
	});
});
