import { StorageFieldType, StorageMeasurementSchema } from '../storage/storage.types';

export const API_MODULE_PREFIX = 'api';

export const API_MODULE_NAME = 'api-module';

/** Comma-separated IPs/CIDRs allowed to hand the backend forwarded-identity headers. */
export const TRUSTED_PROXIES_ENV_KEY = 'FB_TRUSTED_PROXIES';

/** `TrustedProxyRegistryService` source id for the `FB_TRUSTED_PROXIES` env contribution. */
export const ENV_TRUSTED_PROXY_SOURCE_ID = 'env';

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
