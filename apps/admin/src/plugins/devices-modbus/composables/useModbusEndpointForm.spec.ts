import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesModbusPluginFraming } from '../../../openapi.constants';
import { DevicesModbusApiException } from '../devices-modbus.exceptions';
import type { IModbusEndpoint } from '../store/endpoints.types';
import { modbusEndpointsStoreKey } from '../store/keys';

import { useModbusEndpointForm } from './useModbusEndpointForm';

const endpointsStore = { add: vi.fn(), edit: vi.fn() };
const configPluginsStore = {
	findByType: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: (key: symbol) => (key === modbusEndpointsStoreKey ? endpointsStore : configPluginsStore),
		}),
	};
});

const existing: IModbusEndpoint = {
	id: 'e1',
	name: 'Gateway',
	host: '10.0.0.1',
	port: 502,
	framing: DevicesModbusPluginFraming.tcp,
	connectTimeoutMs: 3000,
	requestTimeoutMs: 1500,
	interRequestDelayMs: 0,
	maxInFlight: 2,
	enabled: true,
	createdAt: new Date(),
	updatedAt: null,
};

describe('useModbusEndpointForm', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		configPluginsStore.findByType.mockReturnValue({ defaultConnectTimeoutMs: 2500, defaultRequestTimeoutMs: 700 });
	});

	it('applies config defaults for a new endpoint', () => {
		const { model } = useModbusEndpointForm();

		expect(model.connectTimeoutMs).toBe(2500);
		expect(model.requestTimeoutMs).toBe(700);
		expect(model.port).toBe(502);
		expect(model.framing).toBe('tcp');
	});

	it('uses the endpoint values when editing', () => {
		const { model } = useModbusEndpointForm(existing);

		expect(model.connectTimeoutMs).toBe(3000);
		expect(model.maxInFlight).toBe(2);
	});

	it('forces max in flight 1 for rtu over tcp', async () => {
		const { model, maxInFlightDisabled, setFraming } = useModbusEndpointForm(existing);
		expect(maxInFlightDisabled.value).toBe(false);

		setFraming(DevicesModbusPluginFraming.rtu_over_tcp);

		expect(model.interRequestDelayMs).toBe(20);
		expect(model.maxInFlight).toBe(1);
		expect(maxInFlightDisabled.value).toBe(true);
	});

	it('submits a new endpoint through add and an existing one through edit', async () => {
		endpointsStore.add.mockResolvedValue({ ...existing, id: 'new' });
		const create = useModbusEndpointForm();
		create.model.name = 'New';
		create.model.host = '1.1.1.1';
		await create.submit();
		expect(endpointsStore.add).toHaveBeenCalledWith(expect.objectContaining({ name: 'New', host: '1.1.1.1', connectTimeoutMs: 2500 }));

		endpointsStore.edit.mockResolvedValue(existing);
		const edit = useModbusEndpointForm(existing);
		await edit.submit();
		expect(endpointsStore.edit).toHaveBeenCalledWith('e1', expect.objectContaining({ name: 'Gateway' }));
	});

	it('maps a backend host error onto the host field', async () => {
		endpointsStore.add.mockRejectedValue(
			new DevicesModbusApiException('An endpoint with this host and port already exists.', 400, [
				{ field: 'host', reason: 'An endpoint with this host and port already exists.' },
			])
		);
		const { model, fieldErrors, formAlert, submit } = useModbusEndpointForm();
		model.name = 'x';
		model.host = '10.0.0.1';

		await expect(submit()).rejects.toThrow();

		expect(fieldErrors.host).toBe('An endpoint with this host and port already exists.');
		expect(formAlert.value).toBeNull();
	});

	it('shows an unmatched backend error as a form alert', async () => {
		endpointsStore.add.mockRejectedValue(new DevicesModbusApiException('Something broke.', 500));
		const { model, fieldErrors, formAlert, submit } = useModbusEndpointForm();
		model.name = 'x';
		model.host = '10.0.0.1';

		await expect(submit()).rejects.toThrow();

		expect(fieldErrors.host).toBeUndefined();
		expect(formAlert.value).toBe('Something broke.');
	});
});
