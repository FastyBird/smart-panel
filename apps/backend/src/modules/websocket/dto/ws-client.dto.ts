import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { ClientUserDto } from './client-user.dto';

export enum WsClientEventType {
	CONNECTED = 'connected',
	DISCONNECTED = 'disconnected',
	LOST = 'lost',
}

export class WsClientDto {
	@Expose({ name: 'socket_id' })
	@IsString()
	socketId: string;

	@Expose({ name: 'ip_address' })
	@IsOptional()
	@IsString()
	ipAddress?: string | null;

	@Expose()
	@IsOptional()
	user?: ClientUserDto | null;

	@Expose({ name: 'event_type' })
	@IsEnum(WsClientEventType)
	eventType: WsClientEventType;

	@Expose()
	@IsOptional()
	@IsString()
	timestamp?: string;
}
