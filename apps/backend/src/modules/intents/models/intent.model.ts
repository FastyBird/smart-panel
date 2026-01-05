import { Expose, Type } from 'class-transformer';
import {
	IsArray,
	IsDate,
	IsEnum,
	IsISO8601,
	IsIn,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateNested,
} from 'class-validator';

import { INTENT_ORIGINS, IntentOrigin, IntentStatus, IntentTargetStatus, IntentType } from '../intents.constants';

/**
 * Represents a target affected by an intent.
 * Can be either a device target (deviceId/channelId/propertyId) or a scene target (sceneId).
 * At least one of deviceId or sceneId should be provided.
 */
export class IntentTarget {
	@Expose({ name: 'device_id' })
	@IsOptional()
	@IsUUID()
	deviceId?: string;

	@Expose({ name: 'channel_id' })
	@IsOptional()
	@IsUUID()
	channelId?: string;

	@Expose({ name: 'property_id' })
	@IsOptional()
	@IsUUID()
	propertyId?: string;

	@Expose({ name: 'scene_id' })
	@IsOptional()
	@IsUUID()
	sceneId?: string;
}

/**
 * Represents the result for a specific target after intent completion.
 * Mirrors IntentTarget structure - either device target or scene target.
 */
export class IntentTargetResult {
	@Expose({ name: 'device_id' })
	@IsOptional()
	@IsUUID()
	deviceId?: string;

	@Expose({ name: 'channel_id' })
	@IsOptional()
	@IsUUID()
	channelId?: string;

	@Expose({ name: 'property_id' })
	@IsOptional()
	@IsUUID()
	propertyId?: string;

	@Expose({ name: 'scene_id' })
	@IsOptional()
	@IsUUID()
	sceneId?: string;

	@Expose()
	@IsEnum(IntentTargetStatus)
	status: IntentTargetStatus;

	@Expose()
	@IsOptional()
	@IsString()
	error?: string;
}

/**
 * Optional scope context for an intent.
 * This is "where it applies" (room/zone). In SmartPanel this is always a Space.
 */
export class IntentScope {
	@Expose({ name: 'space_id' })
	@IsOptional()
	@IsUUID()
	spaceId?: string;
}

/**
 * Context information about where and how the intent was initiated.
 * This is NOT authoritative business logic; it is metadata for UI/overlay/debugging.
 */
export class IntentContext {
	@Expose()
	@IsOptional()
	@IsIn(INTENT_ORIGINS)
	origin?: IntentOrigin;

	@Expose({ name: 'display_id' })
	@IsOptional()
	@IsUUID()
	displayId?: string;

	/**
	 * Optional hint for system pages: which space view initiated the action.
	 * Not authoritative; can be omitted (e.g., dashboard tiles without room context).
	 */
	@Expose({ name: 'space_id' })
	@IsOptional()
	@IsUUID()
	spaceId?: string;

	/**
	 * Optional domain hint (e.g., lighting role key: "main" | "ambient" | ...).
	 * Keep as string (enum keys), NOT UUID.
	 */
	@Expose({ name: 'role_key' })
	@IsOptional()
	@IsString()
	roleKey?: string;

	@Expose()
	@IsOptional()
	@IsObject()
	extra?: Record<string, unknown>;
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
	@IsOptional()
	@ValidateNested()
	@Type(() => IntentContext)
	context?: IntentContext;

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
	@IsInt()
	@Min(0)
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

	@IsOptional()
	@ValidateNested()
	@Type(() => IntentContext)
	context?: IntentContext;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => IntentTarget)
	targets: IntentTarget[];

	value: unknown;

	@IsOptional()
	@IsInt()
	@Min(0)
	ttlMs?: number;
}

/**
 * Payload for Socket.IO intent events
 */
export class IntentEventPayload {
	@Expose({ name: 'intent_id' })
	@IsUUID()
	intentId: string;

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
	@IsOptional()
	@ValidateNested()
	@Type(() => IntentContext)
	context?: IntentContext;

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
	@IsInt()
	@Min(0)
	ttlMs: number;

	@Expose({ name: 'created_at' })
	@IsISO8601()
	createdAt: string;

	@Expose({ name: 'expires_at' })
	@IsISO8601()
	expiresAt: string;

	@Expose({ name: 'completed_at' })
	@IsOptional()
	@IsISO8601()
	completedAt?: string;

	@Expose()
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => IntentTargetResult)
	results?: IntentTargetResult[];
}
