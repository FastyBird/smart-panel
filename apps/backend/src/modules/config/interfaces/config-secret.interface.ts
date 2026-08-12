/**
 * Declares a write-only field in a module or plugin configuration mapping.
 *
 * Paths use the serialized names produced by class-transformer (for example
 * `api_key` or `mqtt.password`). `inputPaths` is only needed when callers may
 * submit aliases that differ from the persisted/serialized field name.
 */
export interface ConfigSecretField {
	path: string;
	configuredPath: string;
	inputPaths?: readonly string[];
}
