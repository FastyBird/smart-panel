import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ClientUserDto } from './client-user.dto';

export enum WsClientEventType {
	CONNECTED = 'connected',
	DISCONNECTED = 'disconnected',
	LOST = 'lost',
}

export class WsClientDto {
	@ApiProperty({
		name: 'socket_id',
		description: 'WebSocket client socket ID',
		type: 'string',
	})
	@Expose({ name: 'socket_id' })
	@IsString()
	socketId: string;

	@ApiPropertyOptional({
		name: 'ip_address',
		description: 'Client IP address',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'ip_address' })
	@IsOptional()
	@IsString()
	ipAddress?: string | null;

	@ApiPropertyOptional({
		description: 'Connected user information',
		type: () => ClientUserDto,
		nullable: true,
	})
	@Expose()
	@IsOptional()
	user?: ClientUserDto | null;

	@ApiProperty({
		name: 'event_type',
		description: 'WebSocket client event type',
		enum: WsClientEventType,
	})
	@Expose({ name: 'event_type' })
	@IsEnum(WsClientEventType)
	eventType: WsClientEventType;

	@ApiPropertyOptional({
		description: 'Event timestamp',
		type: 'string',
	})
	@Expose()
	@IsOptional()
	@IsString()
	timestamp?: string;
}
