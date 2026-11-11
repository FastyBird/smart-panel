import { type ComputedRef, type Ref, computed, reactive, ref } from 'vue';

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
	maxInFlightDisabled: ComputedRef<boolean>;
	/** True when the required fields (name and host) are filled in. */
	requiredFilled: ComputedRef<boolean>;
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
	const maxInFlightDisabled = computed<boolean>(() => model.framing === DevicesModbusPluginFraming.rtu_over_tcp);
	const requiredFilled = computed<boolean>(() => model.name.trim() !== '' && model.host.trim() !== '');

	const setFraming = (framing: DevicesModbusPluginFraming): void => {
		model.framing = framing;
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

	let pending: Promise<IModbusEndpoint> | null = null;

	// A second submit while one is saving joins it instead of sending another POST/PATCH.
	const submit = (): Promise<IModbusEndpoint> => {
		pending ??= save().finally(() => {
			pending = null;
		});

		return pending;
	};

	const save = async (): Promise<IModbusEndpoint> => {
		clearErrors();
		submitting.value = true;

		try {
			const payload = { ...model, name: model.name.trim(), host: model.host.trim() };

			if (!endpoint) {
				return await endpointsStore.add(payload);
			}

			// Only what the user changed: a field captured before a concurrent update (an Enabled toggle still in flight,
			// another administrator's edit) must not be written back over it.
			const changed = Object.fromEntries(
				(Object.keys(payload) as (keyof typeof payload)[]).filter((key) => payload[key] !== endpoint[key]).map((key) => [key, payload[key]])
			) as Partial<typeof payload>;

			return Object.keys(changed).length === 0 ? endpoint : await endpointsStore.edit(endpoint.id, changed);
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

	return { model, fieldErrors, formAlert, submitting, maxInFlightDisabled, requiredFilled, setFraming, submit };
};
