export const API_PREFIX = 'api';
export const MODULES_PREFIX = 'modules';
export const PLUGINS_PREFIX = 'plugins';

export enum RequestResultState {
	SUCCESS = 'success',
	ERROR = 'error',
}

// INSECURE DEFAULT — only for development
export const DEFAULT_TOKEN_SECRET = 'g3xHbkELpMD9LRqW4WmJkHL7kz2bdNYAQJyEuFVzR3k=';

export const DEFAULT_TOKEN_EXPIRATION = '1h';

export const MULTIPART_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
