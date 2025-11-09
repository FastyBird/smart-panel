import { FieldType, ISchemaOptions } from 'influx';

export const API_MODULE_PREFIX = 'api-module';

export const API_MODULE_NAME = 'api-module';

export const ApiStatsInfluxDbSchema: ISchemaOptions = {
	measurement: 'api_minute',
	fields: { count: FieldType.INTEGER, errors: FieldType.INTEGER, p95_ms: FieldType.INTEGER, avg_ms: FieldType.INTEGER },
	tags: ['route', '_all'],
};
