import { StorageFieldType, StorageMeasurementSchema } from '../storage/storage.types';

export const WEBSOCKET_MODULE_PREFIX = 'websocket';

export const WEBSOCKET_MODULE_NAME = 'websocket-module';

export const CLIENT_DEFAULT_ROOM = 'default-room';
export const DISPLAY_INTERNAL_ROOM = 'display-room';
export const EXCHANGE_ROOM = 'exchange-room';

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
