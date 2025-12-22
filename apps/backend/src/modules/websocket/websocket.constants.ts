import { FieldType, ISchemaOptions } from 'influx';

export const WEBSOCKET_MODULE_PREFIX = 'websocket';

export const WEBSOCKET_MODULE_NAME = 'websocket-module';

export const CLIENT_DEFAULT_ROOM = 'default-room';
export const DISPLAY_INTERNAL_ROOM = 'display-room';
export const EXCHANGE_ROOM = 'exchange-room';

export const WsStatsInfluxDbSchema: ISchemaOptions = {
	measurement: 'ws_heartbeat',
	fields: { n: FieldType.INTEGER },
	tags: [],
};

export const WsConnInfluxDbSchema: ISchemaOptions = {
	measurement: 'ws_conn',
	fields: { clients: FieldType.INTEGER },
	tags: [],
};

export enum WsEventType {
	CLIENT_CONNECTED = 'WebsocketModule.Client.Connected',
	CLIENT_DISCONNECTED = 'WebsocketModule.Client.Disconnected',
	CLIENT_LOST = 'WebsocketModule.Client.Lost',
}
