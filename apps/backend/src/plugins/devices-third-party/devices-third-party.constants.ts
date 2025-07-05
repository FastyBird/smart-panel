export const DEVICES_THIRD_PARTY_PLUGIN_PREFIX = 'devices-third-party-plugin';

export const DEVICES_THIRD_PARTY_PLUGIN_NAME = 'devices-third-party-plugin';

export const DEVICES_THIRD_PARTY_TYPE = 'third-party';

export enum ThirdPartyPropertiesUpdateStatus {
	SUCCESS = 0, // The request was processed successfully.
	INSUFFICIENT_PRIVILEGES = -80001, // Request denied due to insufficient privileges.
	OPERATION_NOT_SUPPORTED = -80002, // Unable to perform operation with the requested service or property (e.g., device powered off).
	RESOURCE_BUSY = -80003, // Resource is busy. Please try again later.
	READ_ONLY_PROPERTY = -80004, // Cannot write to a read-only property.
	WRITE_ONLY_PROPERTY = -80005, // Cannot read from a write-only property.
	NOTIFICATION_NOT_SUPPORTED = -80006, // Notification is not supported for this property.
	OUT_OF_RESOURCES = -80007, // Out of resources to process request.
	TIMEOUT = -80008, // Operation timed out.
	RESOURCE_NOT_FOUND = -80009, // Resource does not exist.
	INVALID_VALUE = -80010, // Invalid value received in the request.
	UNAUTHORIZED = -80011, // Insufficient authorization to modify this property.
}
