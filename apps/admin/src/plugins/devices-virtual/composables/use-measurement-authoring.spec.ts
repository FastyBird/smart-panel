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
	it('keeps missing custom versions and parameters for repair without an implicit upgrade', async () => {
		const stored = {
			...config(),
			policy: {
				operator: 'extension',
				contractVersion: 1,
				operatorId: '@fixture/operator:offset',
				operatorVersion: 7,
				parameters: { offset: 2 },
				inputRange: { minimum: 0, maximum: 100 },
				outputRange: { minimum: 0, maximum: 100 },
			},
		};
		client.GET.mockResolvedValueOnce({ data: { data: stored } }).mockResolvedValueOnce({ data: { data: [] } });
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_transform, 'output');
		await authoring.load();
		await authoring.loadCapabilities();
		expect(authoring.model.extensionKey).toBe('@fixture/operator:offset@7');
		expect(authoring.model.parameters).toEqual({ offset: 2 });
		expect(authoring.current.value).toEqual(stored);
		expect(authoring.canPreview.value).toBe(false);
		await authoring.save();
		expect(client.PUT).not.toHaveBeenCalled();
		expect(authoring.error.value).toBe('measurementOperatorMissing');
	});

	it('preserves unsupported saved contracts even when the same operator version is available', async () => {
		const policy = {
			operator: 'extension',
			contractVersion: 2,
			operatorId: '@fixture/operator:offset',
			operatorVersion: 1,
			parameters: { offset: 2 },
			inputRange: { minimum: 0, maximum: 100 },
			outputRange: { minimum: 0, maximum: 100 },
		};
		client.GET.mockResolvedValueOnce({ data: { data: { ...config(), policy } } }).mockResolvedValueOnce({
			data: { data: [{ ...policy, contractVersion: 1 }] },
		});
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_transform, 'output');
		await authoring.load();
		await authoring.loadCapabilities();
		expect(authoring.model.extensionKey).toContain('contract 2');
		expect(authoring.selectedOperator.value).toBeUndefined();
		expect(authoring.canPreview.value).toBe(false);
		await authoring.save();
		expect(client.PUT).not.toHaveBeenCalled();
		expect(authoring.current.value).toMatchObject({ policy });
	});
	it('requires explicit repair before discarding unknown saved parameters or policy fields', async () => {
		const policy = {
			operator: 'extension',
			contractVersion: 1,
			operatorId: '@fixture/operator:offset',
			operatorVersion: 1,
			parameters: { offset: 2, future: 3 },
			futurePolicy: 4,
			inputRange: { minimum: 0, maximum: 100 },
			outputRange: { minimum: 0, maximum: 100 },
		};
		const descriptor = {
			...policy,
			input: { quantity: 'temperature', unit: '°C' },
			output: { quantity: 'temperature', unit: '°C' },
			parameters: { offset: { required: true, minimum: -10, maximum: 10 } },
		};
		client.GET.mockResolvedValueOnce({ data: { data: { ...config(), policy } } }).mockResolvedValueOnce({ data: { data: [descriptor] } });
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_transform, 'output');
		await authoring.load();
		await authoring.loadCapabilities();
		await authoring.save();
		expect(client.PUT).not.toHaveBeenCalled();
		expect(authoring.model.parameters).toEqual({ offset: 2, future: 3 });
		delete authoring.model.parameters.future; // An explicit parameter edit still retains unrecognized top-level data for backend rejection.
		client.PUT.mockResolvedValue({ data: { data: { ...config(), policy } } });
		await authoring.save();
		expect(client.PUT.mock.calls[0][1].body.policy.futurePolicy).toBe(4);
		authoring.selectOperator();
		authoring.model.parameters.offset = 2;
		await authoring.save();
		expect(client.PUT.mock.calls[1][1].body.policy).not.toHaveProperty('futurePolicy');
	});
	it('uses explicit descriptor versions and finite bounded numeric parameters', async () => {
		const descriptor = {
			contractVersion: 1,
			name: 'offset',
			operatorId: '@fixture/operator:offset',
			operatorVersion: 2,
			input: { quantity: 'temperature', unit: '°C' },
			output: { quantity: 'temperature', unit: '°C' },
			inputRange: { minimum: -40, maximum: 100 },
			outputRange: { minimum: -50, maximum: 110 },
			parameters: { offset: { required: true, minimum: -10, maximum: 10 } },
		};
		client.GET.mockResolvedValue({ data: { data: [descriptor] } });
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_transform);
		await authoring.loadCapabilities();
		Object.assign(authoring.model, { operator: 'extension', extensionKey: '@fixture/operator:offset@2', inputs: [{ source_property: 'physical' }] });
		authoring.selectOperator();
		authoring.model.parameters.offset = Infinity;
		await authoring.previewDraft();
		expect(client.POST).not.toHaveBeenCalled();
		authoring.model.parameters.offset = 11;
		await authoring.previewDraft();
		expect(client.POST).not.toHaveBeenCalled();
		authoring.model.parameters.offset = -10;
		client.POST.mockResolvedValue({ data: { data: config() } });
		await authoring.previewDraft();
		expect(client.POST.mock.calls[0][1].body.configuration.policy).toMatchObject({
			operator: 'extension',
			contractVersion: 1,
			operatorId: '@fixture/operator:offset',
			operatorVersion: 2,
			parameters: { offset: -10 },
		});
	});

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
	it('authors and reloads explicit Steinhart-Hart coefficients without beta parameters', async () => {
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_transform);
		Object.assign(authoring.model, {
			name: 'Floor thermistor',
			operator: DevicesVirtualPluginNumericTransformPolicyOperator.steinhart_hart,
			inputMinimum: 0,
			inputMaximum: 10,
			outputMinimum: -100,
			outputMaximum: 150,
			referenceVoltage: 10,
			seriesResistance: 10000,
			coefficientA: 0.0010351024725298568,
			coefficientB: 0.0002338353574079741,
			coefficientC: 7.917851073336009e-8,
			thermistorLeg: 'low',
			previewInput: 6.68,
			inputs: [{ source_property: 'physical-voltage' }],
		});
		client.POST.mockResolvedValueOnce({ data: { data: { ...config(), graph_revision: 3 } } });
		await authoring.previewDraft();
		const policy = client.POST.mock.calls[0][1].body.configuration.policy;
		expect(policy).toMatchObject({
			operator: 'steinhart_hart',
			coefficientA: 0.0010351024725298568,
			coefficientB: 0.0002338353574079741,
			coefficientC: 7.917851073336009e-8,
			thermistorLeg: 'low',
		});
		expect(policy).not.toHaveProperty('beta');
		client.GET.mockResolvedValueOnce({ data: { data: { ...config(), policy } } });
		const reopened = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_transform, 'output');
		await reopened.load();
		expect(reopened.model).toMatchObject({
			operator: DevicesVirtualPluginNumericTransformPolicyOperator.steinhart_hart,
			coefficientA: policy.coefficientA,
			coefficientB: policy.coefficientB,
			coefficientC: policy.coefficientC,
		});
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

const capability = (profile: string, numeric = true) => ({
	profile,
	channel: profile,
	quantity: numeric ? profile : 'detected',
	unit: numeric ? '%' : null,
	data_types: [numeric ? 'uchar' : 'bool'],
	operators: numeric ? ['mean', 'weighted_mean'] : ['any', 'all'],
	numeric_policy: numeric,
	output_step: numeric ? 1 : null,
});
const aggregateState = (profile = 'humidity') => ({
	profile,
	operator: profile === 'contact' ? 'any' : 'weighted_mean',
	output_property: 'output',
	output_step: profile === 'contact' ? null : 1,
	outlier_filter: profile === 'contact' ? null : { kind: 'absolute_deviation_from_median', threshold: 5 },
	maximum_age_seconds: 30,
	minimum_valid_inputs: 2,
	revision: 7,
	graph_revision: 10,
	runtime_readiness: 'ready',
	inputs: [
		{ id: 'binding', source_property: null, source_identity: 'deleted-source', weight: 3, exclusion: 'missing' },
		{ id: 'binding2', source_property: 'source2', source_identity: 'source2', weight: 1 },
	],
});
function aggregateApi(profile = 'humidity') {
	client.GET.mockImplementation(async (path: string) => ({
		data: {
			data: path.endsWith('aggregate-profiles')
				? [capability('temperature'), capability('humidity'), capability('contact', false)]
				: path.endsWith('/sources')
					? [{ property: 'allowed', channel: 'c', device: 'd' }]
					: aggregateState(profile),
		},
	}));
}

describe('extended aggregate authoring contracts', () => {
	it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, undefined])(
		'rejects enabled filter threshold %s before preview or save',
		async (threshold) => {
			aggregateApi();
			const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_aggregate, 'output');
			await authoring.load();
			await authoring.loadCapabilities();
			authoring.model.filterThreshold = threshold;
			expect(authoring.canPreview.value).toBe(false);
			await authoring.previewDraft();
			await authoring.save();
			expect(client.POST).not.toHaveBeenCalled();
			expect(client.PUT).not.toHaveBeenCalled();
			expect(authoring.error.value).toBe('measurementFinite');
			authoring.model.filterThreshold = 0.000001;
			expect(authoring.canPreview.value).toBe(true);
			authoring.model.filterThreshold = undefined;
			authoring.model.filterEnabled = false;
			expect(authoring.canPreview.value).toBe(true);
			client.POST.mockResolvedValueOnce({ data: { data: aggregateState() } });
			await authoring.previewDraft();
			expect(client.POST.mock.calls[0][1].body.outlier_filter).toBeNull();
		}
	);
	it('loads restored edit sources once after capabilities and loads a subsequent profile change', async () => {
		aggregateApi();
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_aggregate, 'output');
		await authoring.load();
		expect(client.GET).toHaveBeenCalledTimes(1);
		expect(authoring.model.profile).toBe('humidity');
		await authoring.loadCapabilities();
		expect(client.GET).toHaveBeenCalledTimes(3);
		expect(client.GET.mock.calls[2][1]).toEqual({ params: { path: { profile: 'humidity' } } });
		authoring.model.profile = 'contact' as typeof authoring.model.profile;
		expect(client.GET).toHaveBeenCalledTimes(4);
		expect(client.GET.mock.calls[3][1]).toEqual({ params: { path: { profile: 'contact' } } });
		expect(authoring.preview.value).toBeNull();
	});
	it('uses backend candidates and drafts canonical humidity with its integer type and grid', async () => {
		aggregateApi();
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_aggregate);
		await authoring.loadCapabilities();
		authoring.model.profile = 'humidity' as typeof authoring.model.profile;
		Object.assign(authoring.model, {
			name: 'Humidity',
			aggregateOperator: 'weighted_mean',
			filterEnabled: true,
			filterThreshold: 5,
			inputs: [{ source_property: 'allowed', weight: 3 }, { source_property: 'source2' }],
		});
		client.POST.mockResolvedValueOnce({ data: { data: aggregateState() } });
		await authoring.previewDraft();
		expect(client.GET).toHaveBeenCalledWith('/plugins/devices-virtual/producers/aggregate-profiles/{profile}/sources', {
			params: { path: { profile: 'humidity' } },
		});
		expect(authoring.sources.value.map((source) => source.property)).toEqual(['allowed']);
		const body = client.POST.mock.calls[0][1].body;
		expect(body.device.channels[0]).toMatchObject({ category: 'humidity', properties: [{ category: 'humidity', data_type: 'uchar', step: 1 }] });
		expect(body.configuration).toMatchObject({ operator: 'weighted_mean', inputs: [{ weight: 3 }, { weight: 1 }], outlier_filter: { threshold: 5 } });
		expect(authoring.current.value).toBeNull();
		expect(authoring.preview.value).toEqual(aggregateState());
		client.POST.mockResolvedValueOnce({ data: { data: { device: { id: 'new-device' }, configuration: aggregateState() } } });
		expect(await authoring.save()).toBe('new-device');
		expect(client.POST.mock.calls[1][1].body.output_property).toBe(body.output_property);
		expect(client.POST.mock.calls[1][1].body.device.id).toBe(body.device.id);
	});
	it('reopens weighted/filter policy and repairs a missing source without replacing its binding', async () => {
		aggregateApi();
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_aggregate, 'output');
		await authoring.load();
		await authoring.loadCapabilities();
		expect(authoring.model).toMatchObject({
			profile: 'humidity',
			filterEnabled: true,
			filterThreshold: 5,
			inputs: [{ id: 'binding', source_property: null, identity: 'deleted-source', weight: 3 }, {}],
		});
		authoring.model.inputs[0].source_property = 'replacement';
		const repaired = aggregateState();
		repaired.inputs[0].source_property = 'replacement';
		client.PUT.mockResolvedValueOnce({ data: { data: repaired } });
		await authoring.save();
		expect(client.PUT.mock.calls[0][1].body).toMatchObject({
			expected_revision: 7,
			expected_graph_revision: 10,
			inputs: [{ id: 'binding', source_property: 'replacement', weight: 3 }, {}],
			outlier_filter: { threshold: 5 },
		});
	});
	it('removes numeric policy from binary requests and uses the backend operator list', async () => {
		aggregateApi();
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_aggregate);
		await authoring.loadCapabilities();
		authoring.model.profile = 'contact' as typeof authoring.model.profile;
		expect(authoring.model.aggregateOperator).toBe('any');
		expect(authoring.model.inputs).toEqual([]);
		Object.assign(authoring.model, {
			name: 'Doors',
			filterEnabled: true,
			filterThreshold: 4,
			inputs: [
				{ source_property: 'a', weight: 9 },
				{ source_property: 'b', weight: 8 },
			],
		});
		client.POST.mockResolvedValueOnce({ data: { data: aggregateState('contact') } });
		await authoring.previewDraft();
		const body = client.POST.mock.calls[0][1].body;
		expect(body.device.channels[0]).toMatchObject({ category: 'contact', properties: [{ category: 'detected', data_type: 'bool' }] });
		expect(body.device.channels[0].properties[0]).not.toHaveProperty('step');
		expect(body.configuration).not.toHaveProperty('outlier_filter');
		expect(body.configuration.inputs).toEqual([{ source_property: 'a' }, { source_property: 'b' }]);
	});
	it('ignores an older source response when the profile changes', async () => {
		aggregateApi();
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_aggregate);
		await authoring.loadCapabilities();
		let resolve!: (value: unknown) => void;
		client.GET.mockReturnValueOnce(
			new Promise((done) => {
				resolve = done;
			})
		);
		const old = authoring.loadSources();
		authoring.model.profile = 'contact' as typeof authoring.model.profile;
		await authoring.loadSources();
		resolve({ data: { data: [{ property: 'obsolete' }] } });
		await old;
		expect(authoring.sources.value.map((source) => source.property)).toEqual(['allowed']);
	});
	it('does not authorize saving a stale in-flight preview after an edit', async () => {
		aggregateApi();
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_aggregate);
		await authoring.loadCapabilities();
		Object.assign(authoring.model, { name: 'Test', inputs: [{ source_property: 'a' }, { source_property: 'b' }] });
		let resolve!: (value: unknown) => void;
		client.POST.mockReturnValueOnce(
			new Promise((done) => {
				resolve = done;
			})
		);
		const pending = authoring.previewDraft();
		authoring.model.minimumValidInputs = 2;
		resolve({ data: { data: aggregateState() } });
		await pending;
		expect(authoring.preview.value).toBeNull();
	});
});

const evaluatedState = (value: number | boolean | null, expiresAt: string | null, reasons: string[] = []) => ({
	...aggregateState(),
	preview_result: {
		profile: 'humidity',
		unit: '%',
		output_step: 1,
		value,
		quality: value === null ? 'unavailable' : 'degraded',
		reasons,
		evaluated_at: new Date().toISOString(),
		sampled_at: new Date().toISOString(),
		expires_at: expiresAt,
		inputs: aggregateState().inputs,
	},
});
describe('evaluated draft snapshot lifecycle', () => {
	const setup = async () => {
		aggregateApi();
		const authoring = useMeasurementAuthoring(DevicesVirtualPluginDeviceMode.sensor_aggregate);
		await authoring.loadCapabilities();
		Object.assign(authoring.model, { name: 'Draft', inputs: [{ source_property: 'one' }, { source_property: 'two' }] });
		return authoring;
	};
	it('keeps backend false distinct from null and revokes authorization at exact evidence expiry', async () => {
		vi.useFakeTimers();
		try {
			const authoring = await setup();
			const expiry = new Date(Date.now() + 1000).toISOString();
			client.POST.mockResolvedValueOnce({ data: { data: evaluatedState(false, expiry) } });
			await authoring.previewDraft();
			expect(authoring.preview.value).toMatchObject({ preview_result: { value: false, quality: 'degraded' } });
			expect(authoring.canSavePreview.value).toBe(true);
			vi.advanceTimersByTime(1000);
			expect(authoring.preview.value).toBeNull();
			expect(authoring.previewExpired.value).toBe(true);
			expect(authoring.canSavePreview.value).toBe(false);
			client.POST.mockResolvedValueOnce({ data: { data: evaluatedState(null, null, ['quorum_lost']) } });
			await authoring.previewDraft();
			expect(authoring.preview.value).toMatchObject({ preview_result: { value: null, reasons: ['quorum_lost'] } });
			expect(authoring.previewExpired.value).toBe(false);
			authoring.invalidatePreview();
		} finally {
			vi.useRealTimers();
		}
	});
	it('does not install a result already expired when its response arrives', async () => {
		const authoring = await setup();
		client.POST.mockResolvedValueOnce({ data: { data: evaluatedState(40, new Date(Date.now() - 1).toISOString()) } });
		await authoring.previewDraft();
		expect(authoring.preview.value).toBeNull();
		expect(authoring.canSavePreview.value).toBe(false);
	});
	it.each(['source change', 'reload', 'new preview request'] as const)('discards an in-flight response superseded by %s', async (kind) => {
		const authoring = await setup();
		let resolve!: (value: unknown) => void;
		client.POST.mockReturnValueOnce(
			new Promise((done) => {
				resolve = done;
			})
		);
		const pending = authoring.previewDraft();
		if (kind === 'source change') authoring.invalidatePreview();
		else if (kind === 'reload') await authoring.load();
		else await authoring.previewDraft();
		resolve({ data: { data: evaluatedState(40, new Date(Date.now() + 1000).toISOString()) } });
		await pending;
		expect(authoring.preview.value).toBeNull();
		expect(authoring.canSavePreview.value).toBe(false);
	});
	it('shows a revoked backend snapshot without allowing it to satisfy the save gate', async () => {
		const authoring = await setup();
		client.POST.mockResolvedValueOnce({ data: { data: evaluatedState(null, null, ['preview_revoked']) } });
		await authoring.previewDraft();
		expect(authoring.preview.value).toMatchObject({ preview_result: { reasons: ['preview_revoked'] } });
		expect(authoring.canSavePreview.value).toBe(false);
	});
});
