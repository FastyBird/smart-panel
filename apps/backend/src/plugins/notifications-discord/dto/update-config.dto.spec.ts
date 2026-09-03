import { validateSync } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';

import { UpdateNotificationsDiscordConfigDto } from './update-config.dto';

const build = (plain: Record<string, unknown>): UpdateNotificationsDiscordConfigDto =>
	toInstance(
		UpdateNotificationsDiscordConfigDto,
		{ type: 'notifications-discord-plugin', ...plain },
		{ excludeExtraneousValues: false },
	);

describe('UpdateNotificationsDiscordConfigDto', () => {
	describe('webhook_url', () => {
		it('reaches the DTO as null when submitted null', () => {
			expect(build({ webhook_url: null }).webhookUrl).toBeNull();
		});

		it('is undefined when not submitted at all', () => {
			expect(build({}).webhookUrl).toBeUndefined();
		});

		it('accepts a valid https webhook URL', () => {
			expect(validateSync(build({ webhook_url: 'https://discord.com/api/webhooks/1/token' }))).toHaveLength(0);
		});

		it('rejects an http webhook URL', () => {
			expect(validateSync(build({ webhook_url: 'http://discord.com/api/webhooks/1/token' }))).not.toHaveLength(0);
		});

		it('rejects a malformed URL', () => {
			expect(validateSync(build({ webhook_url: 'not-a-url' }))).not.toHaveLength(0);
		});
	});

	describe('username', () => {
		it('accepts null', () => {
			expect(build({ username: null }).username).toBeNull();
		});

		it('accepts a string', () => {
			expect(validateSync(build({ username: 'Smart Panel' }))).toHaveLength(0);
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
