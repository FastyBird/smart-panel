import { type Ref, reactive, ref } from 'vue';

import { injectStoresManager } from '../../../common';
import { configPluginsStoreKey } from '../../../modules/config';
import { DevicesModbusPluginFraming } from '../../../openapi.constants';
import { DEVICES_MODBUS_PLUGIN_NAME } from '../devices-modbus.constants';
import { DevicesModbusApiException } from '../devices-modbus.exceptions';
import type { IModbusEndpoint } from '../store/endpoints.types';
import { modbusEndpointsStoreKey } from '../store/keys';

export interface IModbusEndpointFormModel {
	name: string;
	host: string;
	port: number;
	framing: DevicesModbusPluginFraming;
	connectTimeoutMs: number;
	requestTimeoutMs: number;
	interRequestDelayMs: number;
	maxInFlight: number;
	enabled: boolean;
}

export type ModbusEndpointFormField = keyof IModbusEndpointFormModel;

const FALLBACK_CONNECT_TIMEOUT_MS = 2000;
const FALLBACK_REQUEST_TIMEOUT_MS = 1000;
const RTU_OVER_TCP_INTER_REQUEST_DELAY_MS = 20;

// Backend DTO fields (snake_case) to form fields.
const FIELD_MAP: Record<string, ModbusEndpointFormField> = {
	name: 'name',
	host: 'host',
	port: 'port',
	framing: 'framing',
	connect_timeout_ms: 'connectTimeoutMs',
	request_timeout_ms: 'requestTimeoutMs',
	inter_request_delay_ms: 'interRequestDelayMs',
	max_in_flight: 'maxInFlight',
	enabled: 'enabled',
};

export interface IUseModbusEndpointForm {
	model: IModbusEndpointFormModel;
	fieldErrors: Partial<Record<ModbusEndpointFormField, string>>;
	formAlert: Ref<string | null>;
	submitting: Ref<boolean>;
	maxInFlightDisabled: Ref<boolean>;
	setFraming: (framing: DevicesModbusPluginFraming) => void;
	submit: () => Promise<IModbusEndpoint>;
}

export const useModbusEndpointForm = (endpoint?: IModbusEndpoint): IUseModbusEndpointForm => {
	const storesManager = injectStoresManager();
	const endpointsStore = storesManager.getStore(modbusEndpointsStoreKey);
	const config = storesManager.getStore(configPluginsStoreKey).findByType(DEVICES_MODBUS_PLUGIN_NAME) as
		| { defaultConnectTimeoutMs?: number; defaultRequestTimeoutMs?: number }
		| null
		| undefined;

	const model = reactive<IModbusEndpointFormModel>({
		name: endpoint?.name ?? '',
		host: endpoint?.host ?? '',
		port: endpoint?.port ?? 502,
		framing: endpoint?.framing ?? DevicesModbusPluginFraming.tcp,
		connectTimeoutMs: endpoint?.connectTimeoutMs ?? config?.defaultConnectTimeoutMs ?? FALLBACK_CONNECT_TIMEOUT_MS,
		requestTimeoutMs: endpoint?.requestTimeoutMs ?? config?.defaultRequestTimeoutMs ?? FALLBACK_REQUEST_TIMEOUT_MS,
		interRequestDelayMs: endpoint?.interRequestDelayMs ?? 0,
		maxInFlight: endpoint?.maxInFlight ?? 1,
		enabled: endpoint?.enabled ?? true,
	});

	const fieldErrors = reactive<Partial<Record<ModbusEndpointFormField, string>>>({});
	const formAlert = ref<string | null>(null);
	const submitting = ref<boolean>(false);
	const maxInFlightDisabled = ref<boolean>(model.framing === DevicesModbusPluginFraming.rtu_over_tcp);

	const setFraming = (framing: DevicesModbusPluginFraming): void => {
		model.framing = framing;
		maxInFlightDisabled.value = framing === DevicesModbusPluginFraming.rtu_over_tcp;

		if (maxInFlightDisabled.value) {
			// RTU frames carry no transaction id, so requests must be strictly serial with a pause between them.
			model.interRequestDelayMs = RTU_OVER_TCP_INTER_REQUEST_DELAY_MS;
			model.maxInFlight = 1;
		}
	};

	const clearErrors = (): void => {
		for (const key of Object.keys(fieldErrors)) {
			delete fieldErrors[key as ModbusEndpointFormField];
		}

		formAlert.value = null;
	};

	const submit = async (): Promise<IModbusEndpoint> => {
		clearErrors();
		submitting.value = true;

		try {
			const payload = { ...model, name: model.name.trim(), host: model.host.trim() };

			return endpoint ? await endpointsStore.edit(endpoint.id, payload) : await endpointsStore.add(payload);
		} catch (error: unknown) {
			const fields = error instanceof DevicesModbusApiException ? error.fields : [];
			let matched = false;

			for (const row of fields) {
				const key = row.field ? FIELD_MAP[row.field] : undefined;

				if (key) {
					fieldErrors[key] = row.reason;
					matched = true;
				}
			}

			if (!matched) {
				formAlert.value = error instanceof Error ? error.message : String(error);
			}

			throw error;
		} finally {
			submitting.value = false;
		}
	};

	return { model, fieldErrors, formAlert, submitting, maxInFlightDisabled, setFraming, submit };
};
