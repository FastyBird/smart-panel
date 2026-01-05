import { Expose, Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

import { IntentStatus, IntentTargetStatus, IntentType } from '../intents.constants';

/**
 * Represents a target affected by an intent (device/channel/property)
 */
export class IntentTarget {
	@Expose()
	@IsString()
	deviceId: string;

	@Expose()
	@IsOptional()
	@IsString()
	channelId?: string;

	@Expose()
	@IsOptional()
	@IsString()
	propertyKey?: string;
}

/**
 * Represents the result for a specific target after intent completion
 */
export class IntentTargetResult {
	@Expose()
	@IsString()
	deviceId: string;

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
	@IsString()
	roomId?: string;

	@Expose()
	@IsOptional()
	@IsString()
	roleId?: string;

	@Expose()
	@IsOptional()
	@IsString()
	sceneId?: string;
}

/**
 * Core intent record stored in the in-memory registry
 */
export class IntentRecord {
	@Expose()
	@IsString()
	id: string;

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
