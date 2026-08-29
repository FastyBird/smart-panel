export class HomeyCloudConfigurationError extends Error {
	constructor(message = 'Homey Cloud client configuration is unavailable') {
		super(message);
		this.name = 'HomeyCloudConfigurationError';
	}
}

export class HomeyCloudAuthorizationStateError extends Error {
	constructor(message = 'Homey Cloud authorization state is invalid or expired') {
		super(message);
		this.name = 'HomeyCloudAuthorizationStateError';
	}
}

export class HomeyCloudAuthorizationCapacityError extends Error {
	constructor() {
		super('Homey Cloud authorization is temporarily unavailable');
		this.name = 'HomeyCloudAuthorizationCapacityError';
	}
}

export enum HomeyCloudProviderErrorCategory {
	INVALID_GRANT = 'invalid_grant',
	INVALID_TOKEN = 'invalid_token',
	NO_ELIGIBLE_HOMEYS = 'no_eligible_homeys',
	PROTOCOL = 'protocol',
	RATE_LIMITED = 'rate_limited',
	TIMEOUT = 'timeout',
	UNAVAILABLE = 'unavailable',
}

export enum HomeyCloudProviderOperation {
	EXCHANGE_CODE = 'exchange_code',
	LIST_HOMEYS = 'list_homeys',
	AUTHENTICATE_HOMEY = 'authenticate_homey',
	REFRESH_TOKEN = 'refresh_token',
}

const RETRYABLE_PROVIDER_CATEGORIES = new Set<HomeyCloudProviderErrorCategory>([
	HomeyCloudProviderErrorCategory.TIMEOUT,
	HomeyCloudProviderErrorCategory.UNAVAILABLE,
	HomeyCloudProviderErrorCategory.RATE_LIMITED,
]);

/** Sanitized provider failure that never retains a raw SDK error, response, code, or token. */
export class HomeyCloudProviderError extends Error {
	readonly category: HomeyCloudProviderErrorCategory;
	readonly operation: HomeyCloudProviderOperation;
	readonly retryable: boolean;

	constructor(category: HomeyCloudProviderErrorCategory, operation: HomeyCloudProviderOperation) {
		super(`Homey Cloud provider operation '${operation}' failed (${category})`);

		this.name = 'HomeyCloudProviderError';
		this.category = category;
		this.operation = operation;
		this.retryable = RETRYABLE_PROVIDER_CATEGORIES.has(category);
	}
}

export class HomeyCloudSelectionError extends Error {
	constructor() {
		super('The selected Homey is not available in this authorization transaction');

		this.name = 'HomeyCloudSelectionError';
	}
}
