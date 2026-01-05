import { Expose, Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { IntentStatus, IntentTargetStatus, IntentType } from '../intents.constants';

/**
 * Represents a target affected by an intent (device/channel/property)
 */
export class IntentTarget {
	@Expose()
	@IsUUID()
	deviceId: string;

	@Expose()
	@IsOptional()
	@IsUUID()
	channelId?: string;

	@Expose()
	@IsOptional()
	@IsUUID()
	propertyId?: string;
}

/**
 * Represents the result for a specific target after intent completion
 */
export class IntentTargetResult {
	@Expose()
	@IsUUID()
	deviceId: string;

	@Expose()
	@IsOptional()
	@IsUUID()
	channelId?: string;

	@Expose()
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
	@Expose()
	@IsOptional()
	@IsUUID()
	roomId?: string;

	@Expose()
	@IsOptional()
	@IsUUID()
	roleId?: string;

	@Expose()
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

	@Expose()
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

	@Expose()
	ttlMs: number;

	@Expose()
	@IsDate()
	@Type(() => Date)
	createdAt: Date;

	@Expose()
	@IsDate()
	@Type(() => Date)
	expiresAt: Date;

	@Expose()
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
	@Expose()
	intentId: string;

	@Expose()
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

	@Expose()
	ttlMs: number;

	@Expose()
	createdAt: string;

	@Expose()
	expiresAt: string;

	@Expose()
	@IsOptional()
	completedAt?: string;

	@Expose()
	@IsOptional()
	results?: IntentTargetResult[];
}
