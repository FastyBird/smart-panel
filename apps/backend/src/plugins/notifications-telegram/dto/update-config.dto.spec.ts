import { validateSync } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';

import { UpdateNotificationsTelegramConfigDto } from './update-config.dto';

const build = (plain: Record<string, unknown>): UpdateNotificationsTelegramConfigDto =>
	toInstance(
		UpdateNotificationsTelegramConfigDto,
		{ type: 'notifications-telegram-plugin', ...plain },
		{ excludeExtraneousValues: false },
	);

describe('UpdateNotificationsTelegramConfigDto', () => {
	describe('bot_token', () => {
		it('reaches the DTO as null when submitted null', () => {
			expect(build({ bot_token: null }).botToken).toBeNull();
		});

		it('is undefined when not submitted at all', () => {
			expect(build({}).botToken).toBeUndefined();
		});

		it('accepts a non-empty bot token', () => {
			expect(validateSync(build({ bot_token: '123456:ABC-token' }))).toHaveLength(0);
		});
	});

	describe('chat_id', () => {
		it('accepts null', () => {
			expect(build({ chat_id: null }).chatId).toBeNull();
		});

		it('accepts a string', () => {
			expect(validateSync(build({ chat_id: '123456789' }))).toHaveLength(0);
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
