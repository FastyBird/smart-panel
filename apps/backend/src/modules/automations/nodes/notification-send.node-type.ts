import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import {
	NOTIFICATION_MESSAGE_MAX_LENGTH,
	NOTIFICATION_TITLE_MAX_LENGTH,
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { CreateNotificationInput } from '../../notifications/services/notifications.service';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import { AutomationActionNodeType } from '../graph/node-type';
import { createConfigValidatorFromDto } from '../utils/node-config-dto.utils';

export const NOTIFICATION_SEND_NODE_TYPE = 'notification.send';

const SEVERITIES = Object.values(NotificationSeverity);

export class NotificationSendConfigDto {
	@IsEnum(NotificationSeverity, {
		message: `[{"field":"severity","reason":"The severity must be one of ${SEVERITIES.join(', ')}."}]`,
	})
	severity: NotificationSeverity;

	@IsString({ message: '[{"field":"title","reason":"A title is needed."}]' })
	@IsNotEmpty({ message: '[{"field":"title","reason":"A title is needed."}]' })
	@MaxLength(NOTIFICATION_TITLE_MAX_LENGTH, {
		message: `[{"field":"title","reason":"The title can be at most ${NOTIFICATION_TITLE_MAX_LENGTH} characters long."}]`,
	})
	title: string;

	@IsOptional()
	@IsString({ message: '[{"field":"message","reason":"The message must be a text."}]' })
	@MaxLength(NOTIFICATION_MESSAGE_MAX_LENGTH, {
		message: `[{"field":"message","reason":"The message can be at most ${NOTIFICATION_MESSAGE_MAX_LENGTH} characters long."}]`,
	})
	message?: string;
}

/** The part of `NotificationsService` the action needs. It answers null when it did not take the notification. */
export interface NotificationSender {
	notify(input: CreateNotificationInput): Promise<unknown>;
}

/**
 * The action "send a notification".
 *
 * Raises an event notification with the automations module as its source, so it shows up in the admin and
 * is forwarded to the channels the administrator configured. Title and message are plain text: nothing in
 * them is evaluated (design § Security and safety).
 *
 * The notifications module accepts at most 60 notifications a minute from one source and drops the rest;
 * a dropped notification takes the `error` output.
 */
export const createNotificationSendNodeType = (
	notifications: NotificationSender,
): AutomationActionNodeType<NotificationSendConfigDto> => ({
	type: NOTIFICATION_SEND_NODE_TYPE,
	kind: 'action',
	name: 'Send notification',
	description: 'Raises a notification with a severity, a title and an optional message.',
	validateConfig: createConfigValidatorFromDto(NotificationSendConfigDto),
	configSchema: {
		type: 'object',
		properties: {
			severity: { type: 'string', enum: [...SEVERITIES], description: 'How urgent the notification is.' },
			title: { type: 'string', minLength: 1, maxLength: NOTIFICATION_TITLE_MAX_LENGTH, description: 'Plain text.' },
			message: {
				type: 'string',
				maxLength: NOTIFICATION_MESSAGE_MAX_LENGTH,
				description: 'Plain text; new lines are kept.',
			},
		},
		required: ['severity', 'title'],
		additionalProperties: false,
	},
	execute: async (config, context) => {
		if (context.signal.aborted) {
			return { success: false, reason: 'The run was cancelled before the notification was sent.' };
		}

		const notification = await notifications.notify({
			source: AUTOMATIONS_MODULE_NAME,
			kind: NotificationKind.EVENT,
			severity: config.severity,
			title: config.title,
			...(typeof config.message === 'string' && config.message !== '' ? { message: config.message } : {}),
			actions: [
				{
					type: NotificationActionType.LINK,
					label: 'Open automation',
					url: `/automations/${context.automationId}`,
				},
			],
			data: { automation_id: context.automationId },
		});

		return notification === null || notification === undefined
			? { success: false, reason: 'The notification was not accepted.' }
			: { success: true };
	},
});
