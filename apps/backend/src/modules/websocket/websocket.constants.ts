import { FieldType, ISchemaOptions } from 'influx';

export const WEBSOCKET_MODULE_PREFIX = 'websocket-module';

export const WEBSOCKET_MODULE_NAME = 'websocket-module';

export const CLIENT_DEFAULT_ROOM = 'default-room';
export const DISPLAY_INTERNAL_ROOM = 'display-room';
export const EXCHANGE_ROOM = 'exchange-room';

export const WsStatsInfluxDbSchema: ISchemaOptions = {
	measurement: 'ws_heartbeat',
	fields: { clients: FieldType.INTEGER },
	tags: [],
};

export const WsConnInfluxDbSchema: ISchemaOptions = {
	measurement: 'ws_conn',
	fields: { clients: FieldType.INTEGER },
	tags: [],
};
