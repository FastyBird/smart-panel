import { Expose, Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { IntentStatus, IntentTargetStatus, IntentType } from '../intents.constants';

/**
 * Represents a target affected by an intent (device/channel/property)
 */
export class IntentTarget {
	@Expose({ name: 'device_id' })
	@IsUUID()
	deviceId: string;

	@Expose({ name: 'channel_id' })
	@IsOptional()
	@IsUUID()
	channelId?: string;

	@Expose({ name: 'property_id' })
	@IsOptional()
	@IsUUID()
	propertyId?: string;
}

/**
 * Represents the result for a specific target after intent completion
 */
export class IntentTargetResult {
	@Expose({ name: 'device_id' })
	@IsUUID()
	deviceId: string;

	@Expose({ name: 'channel_id' })
	@IsOptional()
	@IsUUID()
	channelId?: string;

	@Expose({ name: 'property_id' })
	@IsOptional()
	@IsUUID()
	propertyId?: string;

	@Expose()
	@IsEnum(IntentTargetStatus)
	status: IntentTargetStatus;

	@Expose()
	@IsOptional()
	@IsString()
	error?: string;
}

/**
 * Optional scope context for an intent (room, role, scene association)
 */
export class IntentScope {
	@Expose({ name: 'room_id' })
	@IsOptional()
	@IsUUID()
	roomId?: string;

	@Expose({ name: 'role_id' })
	@IsOptional()
	@IsUUID()
	roleId?: string;

	@Expose({ name: 'scene_id' })
	@IsOptional()
	@IsUUID()
	sceneId?: string;
}

/**
 * Core intent record stored in the in-memory registry
 */
export class IntentRecord {
	@Expose()
	@IsUUID()
	id: string;

	@Expose({ name: 'request_id' })
	@IsOptional()
	@IsUUID()
	requestId?: string;

	@Expose()
	@IsEnum(IntentType)
	type: IntentType;

	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => IntentScope)
	scope?: IntentScope;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => IntentTarget)
	targets: IntentTarget[];

	@Expose()
	value: unknown;

	@Expose()
	@IsEnum(IntentStatus)
	status: IntentStatus;

	@Expose({ name: 'ttl_ms' })
	ttlMs: number;

	@Expose({ name: 'created_at' })
	@IsDate()
	@Type(() => Date)
	createdAt: Date;

	@Expose({ name: 'expires_at' })
	@IsDate()
	@Type(() => Date)
	expiresAt: Date;

	@Expose({ name: 'completed_at' })
	@IsOptional()
	@IsDate()
	@Type(() => Date)
	completedAt?: Date;

	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => IntentTargetResult)
	results?: IntentTargetResult[];
}

/**
 * Input for creating a new intent
 */
export class CreateIntentInput {
	@IsOptional()
	@IsUUID()
	requestId?: string;

	@IsEnum(IntentType)
	type: IntentType;

	@IsOptional()
	@ValidateNested()
	@Type(() => IntentScope)
	scope?: IntentScope;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => IntentTarget)
	targets: IntentTarget[];

	value: unknown;

	@IsOptional()
	ttlMs?: number;
}

/**
 * Payload for Socket.IO intent events
 */
export class IntentEventPayload {
	@Expose({ name: 'intent_id' })
	intentId: string;

	@Expose({ name: 'request_id' })
	@IsOptional()
	requestId?: string;

	@Expose()
	type: IntentType;

	@Expose()
	@IsOptional()
	scope?: IntentScope;

	@Expose()
	targets: IntentTarget[];

	@Expose()
	value: unknown;

	@Expose()
	status: IntentStatus;

	@Expose({ name: 'ttl_ms' })
	ttlMs: number;

	@Expose({ name: 'created_at' })
	createdAt: string;

	@Expose({ name: 'expires_at' })
	expiresAt: string;

	@Expose({ name: 'completed_at' })
	@IsOptional()
	completedAt?: string;

	@Expose()
	@IsOptional()
	results?: IntentTargetResult[];
}
