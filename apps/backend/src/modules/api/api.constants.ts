import { StorageFieldType, StorageMeasurementSchema } from '../storage/storage.types';

export const API_MODULE_PREFIX = 'api';

export const API_MODULE_NAME = 'api-module';

export const ApiStatsStorageSchema: StorageMeasurementSchema = {
	measurement: 'api_minute',
	fields: {
		count: StorageFieldType.FLOAT,
		errors: StorageFieldType.FLOAT,
		p95_ms: StorageFieldType.FLOAT,
		avg_ms: StorageFieldType.FLOAT,
	},
	tags: ['route', '_all'],
};
