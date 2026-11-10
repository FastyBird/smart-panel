import { snakeToCamel } from '../../../common';
import type {
	DevicesModbusPluginCreateEndpointSchema,
	DevicesModbusPluginEndpointHealthSchema,
	DevicesModbusPluginEndpointSchema,
	DevicesModbusPluginTemplateCatalogSchema,
	DevicesModbusPluginTemplatePreviewSchema,
	DevicesModbusPluginUpdateEndpointSchema,
} from '../../../openapi.constants';

import type { IModbusEndpoint, IModbusEndpointCreate, IModbusEndpointHealth, IModbusEndpointUpdate } from './endpoints.types';
import type { IModbusTemplateCatalog, IModbusTemplatePreview } from './templates.types';

export const transformModbusEndpoint = (endpoint: DevicesModbusPluginEndpointSchema): IModbusEndpoint => ({
	id: endpoint.id,
	name: endpoint.name,
	host: endpoint.host,
	port: endpoint.port,
	framing: endpoint.framing,
	connectTimeoutMs: endpoint.connect_timeout_ms,
	requestTimeoutMs: endpoint.request_timeout_ms,
	interRequestDelayMs: endpoint.inter_request_delay_ms,
	maxInFlight: endpoint.max_in_flight,
	enabled: endpoint.enabled,
	createdAt: new Date(endpoint.created_at),
	updatedAt: endpoint.updated_at ? new Date(endpoint.updated_at) : null,
});

export const transformModbusEndpointHealth = (health: DevicesModbusPluginEndpointHealthSchema): IModbusEndpointHealth => ({
	state: health.state,
	lastError: health.last_error,
	lastErrorAt: health.last_error_at ? new Date(health.last_error_at) : null,
	averageLatencyMs: health.average_latency_ms,
	requests: health.requests,
	timeouts: health.timeouts,
	overloaded: health.overloaded,
});

// Only the fields the caller set are sent, so a partial update never overwrites untouched columns.
export const transformModbusEndpointRequest = (
	endpoint: IModbusEndpointCreate | IModbusEndpointUpdate
): DevicesModbusPluginCreateEndpointSchema | DevicesModbusPluginUpdateEndpointSchema => {
	const body: Record<string, unknown> = {};

	const fields: [keyof IModbusEndpointCreate, string][] = [
		['name', 'name'],
		['host', 'host'],
		['port', 'port'],
		['framing', 'framing'],
		['connectTimeoutMs', 'connect_timeout_ms'],
		['requestTimeoutMs', 'request_timeout_ms'],
		['interRequestDelayMs', 'inter_request_delay_ms'],
		['maxInFlight', 'max_in_flight'],
		['enabled', 'enabled'],
	];

	for (const [key, wire] of fields) {
		if (endpoint[key] !== undefined) {
			body[wire] = endpoint[key];
		}
	}

	return body as unknown as DevicesModbusPluginCreateEndpointSchema;
};

export const transformModbusTemplateCatalog = (catalog: DevicesModbusPluginTemplateCatalogSchema): IModbusTemplateCatalog => snakeToCamel(catalog);

export const transformModbusTemplatePreview = (preview: DevicesModbusPluginTemplatePreviewSchema): IModbusTemplatePreview => snakeToCamel(preview);
