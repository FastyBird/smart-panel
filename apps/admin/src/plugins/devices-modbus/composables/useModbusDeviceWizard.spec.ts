import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	DevicesModbusPluginByteOrder,
	DevicesModbusPluginDataType,
	DevicesModbusPluginFraming,
	DevicesModbusPluginRegisterType,
} from '../../../openapi.constants';
import { modbusEndpointsStoreKey, modbusTemplatesStoreKey } from '../store/keys';
import type { IModbusTemplatePreview } from '../store/templates.types';

import { useModbusDeviceWizard } from './useModbusDeviceWizard';

const endpointsStore = { add: vi.fn(), edit: vi.fn(), findAll: vi.fn(() => []), fetch: vi.fn(), findById: vi.fn((): unknown => null) };
const templatesStore = { preview: vi.fn(), fetch: vi.fn(), catalog: null };
const configPluginsStore = { findByType: vi.fn() };
const post = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { POST: post } }),
		injectStoresManager: () => ({
			getStore: (key: symbol) => {
				if (key === modbusEndpointsStoreKey) return endpointsStore;
				if (key === modbusTemplatesStoreKey) return templatesStore;

				return configPluginsStore;
			},
		}),
	};
});

const preview = (overrides: Partial<IModbusTemplatePreview> = {}): IModbusTemplatePreview => ({
	templateId: 'acme-io',
	templateRevision: 'r1',
	category: 'switcher' as IModbusTemplatePreview['category'],
	manufacturer: 'Acme',
	model: 'IO-8',
	endpointDefaults: { framing: DevicesModbusPluginFraming.rtu_over_tcp, port: 4001 },
	unitId: 7,
	pollIntervalMs: 500,
	byteOrder: DevicesModbusPluginByteOrder.little,
	wordOrder: DevicesModbusPluginByteOrder.little,
	maxReadRegisters: 60,
	maxReadBits: 1000,
	maxReadGap: 4,
	channels: [
		{
			identifier: 'relay_1',
			name: 'Relay 1',
			category: 'switcher',
			properties: [
				{
					category: 'on',
					dataType: 'bool',
					permissions: ['rw'],
					read: { registerType: DevicesModbusPluginRegisterType.coil, address: 0, dataType: DevicesModbusPluginDataType.bool },
					write: { registerType: DevicesModbusPluginRegisterType.coil, address: 0, dataType: DevicesModbusPluginDataType.bool },
				},
			],
		},
	],
	...overrides,
});

describe('useModbusDeviceWizard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		configPluginsStore.findByType.mockReturnValue({ defaultPollIntervalMs: 1500 });
		templatesStore.preview.mockResolvedValue(preview());
	});

	it('starts with config defaults', () => {
		const wizard = useModbusDeviceWizard();

		expect(wizard.state.step).toBe(0);
		expect(wizard.state.endpointMode).toBe('existing');
		expect(wizard.state.unitId).toBe(1);
		expect(wizard.state.device.pollIntervalMs).toBe(1500);
	});

	it('saves a new endpoint once when leaving step 1', async () => {
		endpointsStore.add.mockResolvedValue({ id: 'e9' });

		const wizard = useModbusDeviceWizard();
		wizard.state.endpointMode = 'new';
		wizard.state.newEndpoint.name = 'Gateway';
		wizard.state.newEndpoint.host = '10.0.0.5';

		expect(wizard.canContinue(0)).toBe(true);

		await wizard.saveNewEndpoint();
		await wizard.saveNewEndpoint();

		expect(endpointsStore.add).toHaveBeenCalledTimes(1);
		expect(wizard.state.endpointMode).toBe('existing');
		expect(wizard.state.endpointId).toBe('e9');
	});

	it('does not allow continuing a new endpoint without a name and host', () => {
		const wizard = useModbusDeviceWizard();
		wizard.state.endpointMode = 'new';

		expect(wizard.canContinue(0)).toBe(false);

		wizard.state.newEndpoint.name = 'Gateway';
		wizard.state.newEndpoint.host = ' ';

		expect(wizard.canContinue(0)).toBe(false);
	});

	it('rejects a unit id outside 0-255', () => {
		const wizard = useModbusDeviceWizard();
		wizard.state.endpointId = 'e1';

		expect(wizard.canContinue(0)).toBe(true);

		wizard.state.unitId = 256;

		expect(wizard.canContinue(0)).toBe(false);
	});

	it('builds the probe target for a saved and for an unsaved endpoint', () => {
		const wizard = useModbusDeviceWizard();

		expect(wizard.probeTarget()).toBeNull();

		wizard.state.endpointId = 'e1';

		expect(wizard.probeTarget()).toEqual({ endpoint_id: 'e1' });

		wizard.state.endpointMode = 'new';
		wizard.state.newEndpoint.host = ' 10.0.0.5 ';

		expect(wizard.probeTarget()).toEqual({
			host: '10.0.0.5',
			port: 502,
			framing: 'tcp',
			connect_timeout_ms: 2000,
			request_timeout_ms: 1000,
		});
	});

	it('applies template defaults without overwriting user changes', async () => {
		const wizard = useModbusDeviceWizard();
		wizard.state.endpointMode = 'new';
		wizard.state.unitId = 5;

		await wizard.applyTemplate('acme-io');

		expect(templatesStore.preview).toHaveBeenCalledWith('acme-io', { unitId: 5 });
		expect(wizard.state.unitId).toBe(5);
		expect(wizard.state.device.pollIntervalMs).toBe(500);
		expect(wizard.state.device.byteOrder).toBe('little');
		expect(wizard.state.newEndpoint.port).toBe(4001);
		expect(wizard.state.newEndpoint.framing).toBe('rtu_over_tcp');
		expect(wizard.state.newEndpoint.interRequestDelayMs).toBe(20);

		wizard.state.device.pollIntervalMs = 900;
		wizard.state.device.byteOrder = DevicesModbusPluginByteOrder.big;
		wizard.state.device.wordOrder = DevicesModbusPluginByteOrder.big;
		templatesStore.preview.mockResolvedValue(preview({ pollIntervalMs: 250, unitId: 9 }));

		await wizard.applyTemplate('acme-io');

		expect(wizard.state.device.pollIntervalMs).toBe(900);
		expect(wizard.state.device.byteOrder).toBe('big');
		expect(wizard.state.device.wordOrder).toBe('big');
		expect(wizard.state.unitId).toBe(5);
	});

	it('takes the template unit id when the user did not change it', async () => {
		const wizard = useModbusDeviceWizard();

		await wizard.applyTemplate('acme-io');

		expect(templatesStore.preview).toHaveBeenCalledWith('acme-io', {});
		expect(wizard.state.unitId).toBe(7);
	});

	it('keeps provenance after applying a template', async () => {
		const wizard = useModbusDeviceWizard();

		await wizard.applyTemplate('acme-io');

		expect(wizard.state.template?.id).toBe('acme-io');
		expect(wizard.state.template?.revision).toBe('r1');
		expect(wizard.state.template?.points).toHaveLength(1);
		expect(wizard.state.points).toHaveLength(1);
		expect(wizard.state.points).not.toBe(wizard.state.template?.points);
		expect(wizard.state.device.category).toBe('switcher');
		expect(wizard.state.templateDevice).toEqual({
			category: 'switcher',
			manufacturer: 'Acme',
			model: 'IO-8',
			maxReadRegisters: 60,
			maxReadBits: 1000,
			maxReadGap: 4,
			endpointDefaults: { framing: DevicesModbusPluginFraming.rtu_over_tcp, port: 4001 },
		});
		expect(wizard.canContinue(1)).toBe(true);
	});

	it('clears the template when starting empty', async () => {
		const wizard = useModbusDeviceWizard();

		expect(wizard.canContinue(1)).toBe(false);

		await wizard.applyTemplate('acme-io');
		wizard.startEmpty();

		expect(wizard.state.template).toBeNull();
		expect(wizard.state.templateDevice).toBeNull();
		expect(wizard.state.points).toEqual([]);
		expect(wizard.canContinue(1)).toBe(true);
	});

	it('ignores a template preview that returns after start empty', async () => {
		let resolvePreview: (value: IModbusTemplatePreview) => void = () => undefined;
		templatesStore.preview.mockReturnValue(new Promise((resolve) => (resolvePreview = resolve)));

		const wizard = useModbusDeviceWizard();
		const pending = wizard.applyTemplate('acme-io');

		wizard.startEmpty();
		resolvePreview(preview());
		await pending;

		expect(wizard.state.template).toBeNull();
		expect(wizard.state.points).toEqual([]);
		expect(wizard.state.startedEmpty).toBe(true);
		expect(wizard.applyingTemplate.value).toBe(false);
	});

	it('does not allow leaving the template step while a template is applying', async () => {
		let resolvePreview: (value: IModbusTemplatePreview) => void = () => undefined;
		templatesStore.preview.mockReturnValue(new Promise((resolve) => (resolvePreview = resolve)));

		const wizard = useModbusDeviceWizard();

		wizard.startEmpty();
		expect(wizard.canContinue(1)).toBe(true);

		const pending = wizard.applyTemplate('acme-io');

		expect(wizard.canContinue(1)).toBe(false);

		resolvePreview(preview());
		await pending;

		expect(wizard.canContinue(1)).toBe(true);
	});

	it('warns when the template expects another framing or port than the selected endpoint', async () => {
		templatesStore.preview.mockResolvedValue(preview());
		endpointsStore.findById.mockReturnValue({ id: 'e1', framing: DevicesModbusPluginFraming.tcp, port: 502 });

		const wizard = useModbusDeviceWizard();
		wizard.state.endpointMode = 'existing';
		wizard.state.endpointId = 'e1';

		expect(wizard.endpointMismatch.value).toBeNull();

		await wizard.applyTemplate('acme-io');

		expect(wizard.endpointMismatch.value).toEqual({
			expected: { framing: DevicesModbusPluginFraming.rtu_over_tcp, port: 4001 },
			actual: { framing: DevicesModbusPluginFraming.tcp, port: 502 },
		});

		endpointsStore.findById.mockReturnValue({ id: 'e1', framing: DevicesModbusPluginFraming.rtu_over_tcp, port: 4001 });
		wizard.state.endpointId = 'e2';
		wizard.state.endpointId = 'e1';

		expect(wizard.endpointMismatch.value).toBeNull();
		expect(endpointsStore.edit).not.toHaveBeenCalled();
	});

	it('lets the later of two racing applies win', async () => {
		const resolvers: ((value: IModbusTemplatePreview) => void)[] = [];
		templatesStore.preview.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));

		const wizard = useModbusDeviceWizard();
		const first = wizard.applyTemplate('a');
		const second = wizard.applyTemplate('b');

		resolvers[1](preview({ templateId: 'b' }));
		await second;
		resolvers[0](preview({ templateId: 'a' }));
		await first;

		expect(wizard.state.template?.id).toBe('b');
		expect(wizard.applyingTemplate.value).toBe(false);
	});

	it('clears the suggested device name when starting empty but keeps a typed one', async () => {
		const wizard = useModbusDeviceWizard();

		await wizard.applyTemplate('acme-io');
		expect(wizard.state.device.name).toBe('Acme IO-8');

		wizard.startEmpty();
		expect(wizard.state.device.name).toBe('');

		await wizard.applyTemplate('acme-io');
		wizard.state.device.name = 'My relay box';
		wizard.startEmpty();
		expect(wizard.state.device.name).toBe('My relay box');
	});

	it('rejects saving when an existing endpoint is not selected', async () => {
		const wizard = useModbusDeviceWizard();

		await expect(wizard.saveNewEndpoint()).rejects.toThrow();
		expect(endpointsStore.add).not.toHaveBeenCalled();
	});

	describe('create', () => {
		const readyWizard = async () => {
			const wizard = useModbusDeviceWizard();

			wizard.state.endpointId = 'e1';
			await wizard.applyTemplate('acme-io');
			wizard.state.device.roomId = 'r1';

			return wizard;
		};

		it('posts the structure once and returns the device id', async () => {
			post.mockResolvedValue({ data: { data: { id: 'd1' } } });

			const wizard = await readyWizard();

			expect(wizard.canContinue(3)).toBe(true);

			const [first, second] = await Promise.all([wizard.create(), wizard.create()]);
			const third = await wizard.create();

			expect([first, second, third]).toEqual(['d1', 'd1', 'd1']);
			expect(post).toHaveBeenCalledTimes(1);
			expect(wizard.submitState.value).toBe('created');

			const [path, options] = post.mock.calls[0];

			expect(path).toBe('/plugins/devices-modbus/devices');
			expect(options.body.data).toMatchObject({
				name: 'Acme IO-8',
				category: 'switcher',
				room_id: 'r1',
				endpoint_id: 'e1',
				unit_id: 7,
				poll_interval_ms: 500,
				manufacturer: 'Acme',
				model: 'IO-8',
				max_read_registers: 60,
				max_read_bits: 1000,
				max_read_gap: 4,
				template_id: 'acme-io',
				template_revision: 'r1',
			});
		});

		it('drops the template provenance once the points are edited', async () => {
			post.mockResolvedValue({ data: { data: { id: 'd1' } } });

			const wizard = await readyWizard();

			wizard.state.points[0].name = 'Renamed';

			await wizard.create();

			expect(post.mock.calls[0][1].body.data.template_id).toBeUndefined();
		});

		it('keeps the error reason on a 400 and allows a retry', async () => {
			post.mockResolvedValueOnce({
				error: { error: { message: 'Invalid structure' }, status: 400 },
				response: { status: 400 },
			});
			post.mockResolvedValueOnce({ data: { data: { id: 'd2' } } });

			const wizard = await readyWizard();

			await expect(wizard.create()).rejects.toThrow();
			expect(wizard.submitState.value).toBe('error');
			expect(wizard.createError.value).toBeTruthy();
			expect(wizard.createError.value).not.toBe('');

			await expect(wizard.create()).resolves.toBe('d2');
			expect(wizard.createError.value).toBeNull();
			expect(post).toHaveBeenCalledTimes(2);
		});

		it('requires a name and a category on the device step', async () => {
			const wizard = useModbusDeviceWizard();

			expect(wizard.canContinue(3)).toBe(false);

			wizard.state.device.name = 'Box';

			expect(wizard.canContinue(3)).toBe(false);

			wizard.state.device.category = 'switcher';

			expect(wizard.canContinue(3)).toBe(true);

			wizard.state.device.name = '  ';

			expect(wizard.canContinue(3)).toBe(false);
		});

		it('requires a poll interval of at least 100 ms on the device step', () => {
			const wizard = useModbusDeviceWizard();

			wizard.state.device.name = 'Box';
			wizard.state.device.category = 'switcher';
			wizard.state.device.pollIntervalMs = null as unknown as number;

			expect(wizard.canContinue(3)).toBe(false);

			wizard.state.device.pollIntervalMs = 50;

			expect(wizard.canContinue(3)).toBe(false);

			wizard.state.device.pollIntervalMs = 100;

			expect(wizard.canContinue(3)).toBe(true);
		});
	});
});
