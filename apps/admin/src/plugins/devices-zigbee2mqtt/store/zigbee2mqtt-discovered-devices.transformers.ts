import type { IZ2mExpose, IZigbee2mqttDiscoveredDevice } from './zigbee2mqtt-discovered-devices.store.types';

type ApiExposeType = {
	type: string;
	property?: string;
	name?: string;
	access?: number;
	unit?: string;
	value_min?: number;
	value_max?: number;
	value_step?: number;
	values?: string[];
	features?: ApiExposeType[];
};

// Manual type definition until OpenAPI is regenerated
type ApiDiscoveredDeviceResponse = {
	ieee_address: string;
	friendly_name: string;
	manufacturer?: string | null;
	model?: string | null;
	description?: string | null;
	exposes?: ApiExposeType[];
	available?: boolean;
	disabled?: boolean;
};

const transformExposes = (exposes: ApiExposeType[]): IZ2mExpose[] => {
	return exposes.map((expose) => ({
		type: expose.type,
		property: expose.property,
		name: expose.name,
		access: expose.access,
		unit: expose.unit,
		valueMin: expose.value_min,
		valueMax: expose.value_max,
		valueStep: expose.value_step,
		values: expose.values,
		features: expose.features ? transformExposes(expose.features) : undefined,
	}));
};

export const transformZigbee2mqttDiscoveredDeviceResponse = (
	response: ApiDiscoveredDeviceResponse
): IZigbee2mqttDiscoveredDevice => {
	return {
		id: response.ieee_address,
		friendlyName: response.friendly_name,
		manufacturer: response.manufacturer ?? null,
		model: response.model ?? null,
		description: response.description ?? null,
		exposes: response.exposes ? transformExposes(response.exposes) : [],
		available: response.available ?? false,
		disabled: response.disabled ?? false,
	};
};
