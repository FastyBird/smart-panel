import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicesVirtualPluginNumericTransformPolicyOperator } from '../../../openapi';
import { DevicesVirtualPluginDeviceMode } from '../../../openapi.constants';

import { useMeasurementAuthoring } from './use-measurement-authoring';

const { client } = vi.hoisted(() => ({ client: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn() } }));
vi.mock('../../../common', () => ({ useBackend: () => ({ client }) }));
const config = () => ({
	output_property: 'output',
	schema_version: 1,
	policy: { operator: 'affine', inputRange: { minimum: 0, maximum: 100 }, outputRange: { minimum: 0, maximum: 100 }, scale: 1, offset: 0 },
	source: { id: 'binding', source_property: null, source_identity: 'deleted-source', quantity: 'voltage', unit: 'V' },
	quantity: 'voltage',
	unit: 'custom mV',
	maximum_age_seconds: 30,
	revision: 7,
	graph_revision: 10,
	runtime_readiness: 'configured',
	quality: 'unavailable',
	current_value: null,
	errors: ['missing'],
});

beforeEach(() => {
	vi.clearAllMocks();
});
describe('measurement authoring API lifecycle', () => {
	it('requires an attainable aggregate minimum while preserving transform preview eligibility', () => {
		const aggregate = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_aggregate);
		aggregate.model.inputs = [{ source_property: 'one' }, { source_property: 'two' }];
		aggregate.model.minimumValidInputs = 3;
		expect(aggregate.canPreview.value).toBe(false);
		aggregate.model.minimumValidInputs = 2;
		expect(aggregate.canPreview.value).toBe(true);
		aggregate.model.inputs[1].source_property = null;
		expect(aggregate.canPreview.value).toBe(false);
		const transform = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_transform);
		transform.model.inputs = [{ source_property: 'one' }];
		transform.model.minimumValidInputs = 3;
		expect(transform.canPreview.value).toBe(true);
	});
	it('reopens custom quantity/unit and keeps a missing stable source binding for repair', async () => {
		client.GET.mockResolvedValue({ data: { data: config() } });
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_transform, 'output');
		await authoring.load();
		expect(authoring.model).toMatchObject({
			temperature: false,
			quantity: 'voltage',
			unit: 'custom mV',
			inputs: [{ id: 'binding', source_property: null, identity: 'deleted-source' }],
		});
		authoring.model.inputs[0].source_property = 'replacement';
		client.PUT.mockResolvedValue({ data: { data: { ...config(), revision: 8 } } });
		await authoring.save();
		expect(client.PUT).toHaveBeenCalledWith(
			'/plugins/devices-virtual/producers/transforms/{id}',
			expect.objectContaining({
				body: expect.objectContaining({
					expected_revision: 7,
					expected_graph_revision: 10,
					quantity: 'voltage',
					unit: 'custom mV',
					source: { id: 'binding', source_property: 'replacement' },
				}),
			})
		);
	});
	it('uses supplied-sample draft preview and atomic creation without writing a core device first', async () => {
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_transform);
		Object.assign(authoring.model, {
			name: 'Converter',
			inputMinimum: 0,
			inputMaximum: 100,
			outputMinimum: 0,
			outputMaximum: 100,
			scale: 1,
			offset: 0,
			previewInput: 22,
			operator: DevicesVirtualPluginNumericTransformPolicyOperator.affine,
			inputs: [{ source_property: 'native-celsius' }],
		});
		client.POST.mockResolvedValueOnce({
			data: { data: { ...config(), graph_revision: 3, preview_result: { input: 22, value: 22, error: null, qualified: false } } },
		});
		await authoring.previewDraft();
		expect(client.POST.mock.calls[0]).toEqual([
			'/plugins/devices-virtual/producers/transforms/draft-preview',
			expect.objectContaining({
				body: expect.objectContaining({ preview_input: 22, configuration: expect.objectContaining({ quantity: 'temperature', unit: '°C' }) }),
			}),
		]);
		expect(authoring.current.value).toBeNull();
		client.POST.mockResolvedValueOnce({ data: { data: { device: { id: 'created' }, configuration: config() } } });
		expect(await authoring.save()).toBe('created');
		expect(client.POST.mock.calls[1][0]).toBe('/plugins/devices-virtual/producers/transforms');
		expect(client.POST.mock.calls[1][1].body).not.toHaveProperty('preview_input');
		expect(client.POST.mock.calls[1][1].body.configuration.expected_graph_revision).toBe(3);
	});
	it('shows a revision conflict and preserves the local repair until explicit reload', async () => {
		client.GET.mockResolvedValue({ data: { data: config() } });
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_transform, 'output');
		await authoring.load();
		authoring.model.unit = 'new unit';
		client.PUT.mockResolvedValue({
			response: { status: 422 },
			error: {
				error: {
					code: 'UnprocessableEntity',
					message: 'The request could not be processed due to semantic issues.',
					details: { reason: 'Producer configuration revision changed; reload and retry.' },
				},
			},
		});
		await authoring.save();
		expect(authoring.conflict.value).toBe(true);
		expect(authoring.model.unit).toBe('new unit');
		await authoring.load();
		expect(authoring.model.unit).toBe('custom mV');
	});
	it('reloads a conflicted draft without losing inputs or retaining its stale graph fence', async () => {
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_transform);
		Object.assign(authoring.model, {
			name: 'Converter',
			inputMinimum: 0,
			inputMaximum: 100,
			outputMinimum: 0,
			outputMaximum: 100,
			scale: 1,
			offset: 0,
			inputs: [{ source_property: 'source' }],
		});
		client.POST.mockResolvedValueOnce({ data: { data: { ...config(), graph_revision: 3 } } });
		await authoring.previewDraft();
		client.POST.mockResolvedValueOnce({
			response: { status: 422 },
			error: { error: { code: 'UnprocessableEntity', details: { reason: 'Virtual dependency graph revision changed; reload and retry.' } } },
		});
		await authoring.previewDraft();
		expect(authoring.conflict.value).toBe(true);
		await authoring.load();
		expect(authoring.model.inputs[0].source_property).toBe('source');
		expect(authoring.preview.value).toBeNull();
		client.POST.mockResolvedValueOnce({ data: { data: { ...config(), graph_revision: 4 } } });
		await authoring.previewDraft();
		expect(client.POST.mock.calls[2][1].body.configuration.expected_graph_revision).toBeUndefined();
	});
	it('clears an existing configuration and revisions when reload returns a real 404', async () => {
		client.GET.mockResolvedValueOnce({ data: { data: config() } });
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_transform, 'output');
		await authoring.load();
		client.GET.mockResolvedValueOnce({ response: { status: 404 }, error: { error: { message: 'Configuration not found' } } });
		await authoring.load();
		expect(authoring.current.value).toBeNull();
		expect(authoring.preview.value).toBeNull();
		client.POST.mockResolvedValue({ data: { data: config() } });
		await authoring.previewDraft();
		expect(client.POST.mock.calls[0][1].body.expected_revision).toBe(0);
		expect(client.POST.mock.calls[0][1].body.expected_graph_revision).toBeUndefined();
	});

	it('refuses absent or nonfinite explicit operator parameters before calling preview', async () => {
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_transform);
		authoring.model.inputs = [{ source_property: 'source' }];
		await authoring.previewDraft();
		expect(authoring.error.value).toBe('measurementFinite');
		expect(client.POST).not.toHaveBeenCalled();
	});
	it('reopens aggregate exclusions and sends retained missing member identity on edit', async () => {
		const input = { id: 'member', source_property: null, source_identity: 'missing-member', exclusion: 'missing' };
		client.GET.mockResolvedValue({
			data: {
				data: {
					revision: 2,
					graph_revision: 5,
					operator: 'median',
					maximum_age_seconds: 60,
					minimum_valid_inputs: 1,
					inputs: [input, { ...input, id: 'member2' }],
				},
			},
		});
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_aggregate, 'aggregate');
		await authoring.load();
		expect(authoring.model.inputs[0]).toEqual({ id: 'member', source_property: null, identity: 'missing-member' });
		client.POST.mockResolvedValue({ data: { data: authoring.current.value } });
		await authoring.previewDraft();
		expect(client.POST.mock.calls[0][1].body.inputs[0]).toEqual({ id: 'member', source_property: null });
	});
});
