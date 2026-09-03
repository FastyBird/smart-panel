import { validateSync } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';

import { UpdateNotificationsSlackConfigDto } from './update-config.dto';

const build = (plain: Record<string, unknown>): UpdateNotificationsSlackConfigDto =>
	toInstance(
		UpdateNotificationsSlackConfigDto,
		{ type: 'notifications-slack-plugin', ...plain },
		{ excludeExtraneousValues: false },
	);

describe('UpdateNotificationsSlackConfigDto', () => {
	describe('webhook_url', () => {
		it('reaches the DTO as null when submitted null', () => {
			expect(build({ webhook_url: null }).webhookUrl).toBeNull();
		});

		it('is undefined when not submitted at all', () => {
			expect(build({}).webhookUrl).toBeUndefined();
		});

		it('accepts a valid https webhook URL', () => {
			expect(validateSync(build({ webhook_url: 'https://hooks.slack.com/services/T0/B0/XYZ' }))).toHaveLength(0);
		});

		it('rejects an http webhook URL', () => {
			expect(validateSync(build({ webhook_url: 'http://hooks.slack.com/services/T0/B0/XYZ' }))).not.toHaveLength(0);
		});

		it('rejects a malformed URL', () => {
			expect(validateSync(build({ webhook_url: 'not-a-url' }))).not.toHaveLength(0);
		});
	});

	describe('min_severity', () => {
		it('accepts a valid severity', () => {
			expect(validateSync(build({ min_severity: NotificationSeverity.CRITICAL }))).toHaveLength(0);
		});

		it('rejects an invalid severity', () => {
			expect(validateSync(build({ min_severity: 'not-a-severity' }))).not.toHaveLength(0);
		});
	});
});
