import { StorageFieldType, StorageMeasurementSchema } from '../storage/storage.types';

export const WEBSOCKET_MODULE_PREFIX = 'websocket';

export const WEBSOCKET_MODULE_NAME = 'websocket-module';

export const CLIENT_DEFAULT_ROOM = 'default-room';
export const DISPLAY_INTERNAL_ROOM = 'display-room';
export const EXCHANGE_ROOM = 'exchange-room';
// Joined automatically at connection time by user principals with an owner or admin role.
// Unlike EXCHANGE_ROOM, membership does not depend on the socket sending subscribe-exchange,
// because that message currently admits any authenticated socket.
export const ADMIN_ROOM = 'admin-room';

export const WsStatsStorageSchema: StorageMeasurementSchema = {
	measurement: 'ws_heartbeat',
	fields: { n: StorageFieldType.FLOAT },
	tags: [],
};

export const WsConnStorageSchema: StorageMeasurementSchema = {
	measurement: 'ws_conn',
	fields: { clients: StorageFieldType.FLOAT },
	tags: [],
};

export enum WsEventType {
	CLIENT_CONNECTED = 'WebsocketModule.Client.Connected',
	CLIENT_DISCONNECTED = 'WebsocketModule.Client.Disconnected',
	CLIENT_LOST = 'WebsocketModule.Client.Lost',
}
