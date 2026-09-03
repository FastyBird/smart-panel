import { Expose, Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsDate, IsEnum, IsInt, IsObject, IsOptional, IsString } from 'class-validator';
import { Column, Entity, Index } from 'typeorm';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseEntity } from '../../../common/entities/base.entity';
import { NotificationActionInput, NotificationActionModel } from '../models/notification-action.model';
import { NotificationKind, NotificationSeverity } from '../notifications.constants';

/**
 * Free-form context shown as a key/value table in the admin. Flat by contract - the core
 * never reads it, so nesting would only be a way to smuggle stack traces into channels.
 */
export type NotificationData = Record<string, string | number | boolean | null>;

const nullableDateToClass = ({ value }: { value: unknown }): Date | null => {
	if (value === null || value === undefined) {
		return null;
	}

	return typeof value === 'string' ? new Date(value) : (value as Date);
};

const nullableDateToPlain = ({ value }: { value: unknown }): unknown =>
	value instanceof Date ? value.toISOString() : value;

@ApiSchema({ name: 'NotificationsModuleDataNotification' })
@Entity('notifications_module_notifications')
// One unresolved row per (source, key). Resolving a row frees the key, so the next
// notify() starts a fresh aggregation window instead of reopening a closed one.
@Index('IDX_notifications_source_key_active', ['source', 'key'], {
	unique: true,
	where: '"key" IS NOT NULL AND "resolvedAt" IS NULL',
})
@Index('IDX_notifications_created_at', ['createdAt'])
@Index('IDX_notifications_dismissed_at', ['dismissedAt'])
@Index('IDX_notifications_resolved_at', ['resolvedAt'])
export class NotificationEntity extends BaseEntity {
	@ApiProperty({
		description: 'Extension type of the emitter, used as the origin, for dedupe and for bulk resolution.',
		type: 'string',
		example: 'system-module',
	})
	@Expose()
	@IsString()
	@Column()
	source: string;

	@ApiProperty({
		description: 'Whether the row records something that happened or a condition that holds.',
		enum: NotificationKind,
		example: NotificationKind.ISSUE,
	})
	@Expose()
	@IsEnum(NotificationKind)
	@Column({ type: 'varchar' })
	kind: NotificationKind;

	@ApiPropertyOptional({
		description: 'Dedupe key, unique per source among unresolved rows. Required for issues.',
		type: 'string',
		nullable: true,
		example: 'update-available',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ type: 'varchar', nullable: true })
	key: string | null;

	@ApiProperty({
		description: 'How urgent the notification is. Channels filter on it.',
		enum: NotificationSeverity,
		example: NotificationSeverity.WARNING,
	})
	@Expose()
	@IsEnum(NotificationSeverity)
	@Column({ type: 'varchar' })
	severity: NotificationSeverity;

	@ApiProperty({
		description: 'Plain text headline.',
		type: 'string',
		example: 'Home Assistant connection lost',
	})
	@Expose()
	@IsString()
	@Column()
	title: string;

	@ApiPropertyOptional({
		description: 'Plain text detail. Newlines allowed.',
		type: 'string',
		nullable: true,
		example: 'The websocket connection was refused: 401 Unauthorized.',
	})
	@Expose()
	@IsOptional()
	@IsString()
	@Column({ type: 'text', nullable: true })
	message: string | null;

	@ApiProperty({
		description: 'Calls to action pointing at endpoints that already exist. At most three.',
		type: 'array',
		items: { $ref: getSchemaPath(NotificationActionModel) },
	})
	@Expose()
	@IsArray()
	@Column({ type: 'simple-json', nullable: true })
	actions: NotificationActionInput[];

	@ApiPropertyOptional({
		description: 'Flat key/value context shown in the detail drawer. Never used for logic.',
		type: 'object',
		additionalProperties: true,
		nullable: true,
		example: { username: 'admin', ip: '192.168.1.20' },
	})
	@Expose()
	@IsOptional()
	@IsObject()
	@Column({ type: 'simple-json', nullable: true })
	data: NotificationData | null;

	@ApiProperty({
		description: 'Issues only. A persistent issue survives a restart untouched; others are resolved at boot.',
		type: 'boolean',
		example: false,
	})
	@Expose()
	@IsBoolean()
	@Column({ type: 'boolean', default: false })
	persistent: boolean;

	@ApiProperty({
		description: 'How often the same (source, key) has been reported since the row was created.',
		type: 'integer',
		example: 3,
	})
	@Expose()
	@IsInt()
	@Column({ type: 'integer', default: 1 })
	occurrences: number;

	@ApiPropertyOptional({
		name: 'read_at',
		description: 'When the notification was marked read.',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2026-09-02T12:00:00Z',
	})
	@Expose({ name: 'read_at' })
	@IsOptional()
	@IsDate()
	@Transform(nullableDateToClass, { toClassOnly: true })
	@Transform(nullableDateToPlain, { toPlainOnly: true })
	@Column({ type: 'datetime', nullable: true })
	readAt: Date | null;

	@ApiPropertyOptional({
		name: 'dismissed_at',
		description: 'When the administrator dismissed the notification.',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2026-09-02T12:00:00Z',
	})
	@Expose({ name: 'dismissed_at' })
	@IsOptional()
	@IsDate()
	@Transform(nullableDateToClass, { toClassOnly: true })
	@Transform(nullableDateToPlain, { toPlainOnly: true })
	@Column({ type: 'datetime', nullable: true })
	dismissedAt: Date | null;

	@ApiPropertyOptional({
		name: 'resolved_at',
		description: 'When the source reported the condition had cleared.',
		type: 'string',
		format: 'date-time',
		nullable: true,
		example: '2026-09-02T12:00:00Z',
	})
	@Expose({ name: 'resolved_at' })
	@IsOptional()
	@IsDate()
	@Transform(nullableDateToClass, { toClassOnly: true })
	@Transform(nullableDateToPlain, { toPlainOnly: true })
	@Column({ type: 'datetime', nullable: true })
	resolvedAt: Date | null;
}
