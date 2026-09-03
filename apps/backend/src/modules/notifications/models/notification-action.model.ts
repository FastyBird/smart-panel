import { Expose } from 'class-transformer';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { NotificationActionType } from '../notifications.constants';

/**
 * Extension kinds a `service` action can target, mirroring `ExtensionKind`.
 */
export type NotificationServiceExtensionKind = 'module' | 'plugin';

/**
 * Operations a `service` action can request of a managed extension service.
 */
export type NotificationServiceOperation = 'start' | 'stop' | 'restart';

/**
 * A call to action attached to a notification.
 *
 * Actions are pure data pointing at endpoints that already exist - the notifications
 * module never executes them. Keys are snake_case because this shape is stored verbatim
 * in the `actions` JSON column and handed to the admin as-is.
 */
export type NotificationActionInput =
	| { type: NotificationActionType.LINK; label: string; url: string; primary?: boolean }
	| {
			type: NotificationActionType.EXTENSION_ACTION;
			label: string;
			extension_type: string;
			action_id: string;
			params?: Record<string, string | number | boolean>;
			primary?: boolean;
	  }
	| {
			type: NotificationActionType.SERVICE;
			label: string;
			extension_kind: NotificationServiceExtensionKind;
			extension_type: string;
			service_id: string;
			operation: NotificationServiceOperation;
			primary?: boolean;
	  };

/**
 * Swagger description of {@link NotificationActionInput}.
 *
 * One model rather than three, because OpenAPI consumers read a single action array and
 * branch on `type`; the variant fields are optional and only meaningful for their own type.
 * Property names are snake_case on purpose - they are the stored JSON keys, not renamed
 * class properties.
 */
@ApiSchema({ name: 'NotificationsModuleDataNotificationAction' })
export class NotificationActionModel {
	@ApiProperty({
		description: 'Action kind. Decides which of the optional fields below are meaningful.',
		enum: NotificationActionType,
		example: NotificationActionType.LINK,
	})
	@Expose()
	@IsEnum(NotificationActionType)
	type: NotificationActionType;

	@ApiProperty({
		description: 'Plain text label rendered on the action control.',
		type: 'string',
		example: 'Open system info',
	})
	@Expose()
	@IsString()
	label: string;

	@ApiPropertyOptional({
		description: 'Whether this action is the primary one. At most one action per notification is primary.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean()
	primary?: boolean;

	@ApiPropertyOptional({
		description: 'Target of a `link` action: an admin-relative path or an absolute http(s) URL.',
		type: 'string',
		example: '/system/info',
	})
	@Expose()
	@IsOptional()
	@IsString()
	url?: string;

	@ApiPropertyOptional({
		description: 'Extension type owning the action or the service, for `extension_action` and `service` actions.',
		type: 'string',
		example: 'devices-home-assistant-plugin',
	})
	@Expose()
	@IsOptional()
	@IsString()
	extension_type?: string;

	@ApiPropertyOptional({
		description: 'Identifier of the extension action to execute, for `extension_action` actions.',
		type: 'string',
		example: 'reconnect',
	})
	@Expose()
	@IsOptional()
	@IsString()
	action_id?: string;

	@ApiPropertyOptional({
		description: 'Parameters handed to the extension action, for `extension_action` actions.',
		type: 'object',
		additionalProperties: true,
		example: { force: true },
	})
	@Expose()
	@IsOptional()
	@IsObject()
	params?: Record<string, string | number | boolean>;

	@ApiPropertyOptional({
		description: 'Whether the managed service belongs to a module or a plugin, for `service` actions.',
		enum: ['module', 'plugin'],
		example: 'plugin',
	})
	@Expose()
	@IsOptional()
	@IsString()
	extension_kind?: NotificationServiceExtensionKind;

	@ApiPropertyOptional({
		description: 'Identifier of the managed service to operate on, for `service` actions.',
		type: 'string',
		example: 'home-assistant-ws',
	})
	@Expose()
	@IsOptional()
	@IsString()
	service_id?: string;

	@ApiPropertyOptional({
		description: 'Operation to request of the managed service, for `service` actions.',
		enum: ['start', 'stop', 'restart'],
		example: 'restart',
	})
	@Expose()
	@IsOptional()
	@IsString()
	operation?: NotificationServiceOperation;
}
