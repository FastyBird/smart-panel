import { defineComponent } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { useDewPointAuthoring } from './use-dew-point-authoring';

const { client } = vi.hoisted(() => ({ client: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn() } }));
vi.mock('../../../common', () => ({ useBackend: () => ({ client }) }));
const state = () => ({
	output_property: 'retained-output',
	schema_version: 1,
	formula_version: 'magnus-water-17.62-243.12-v1',
	revision: 7,
	graph_revision: 12,
	maximum_age_seconds: 30,
	maximum_skew_seconds: 2,
	quantity: 'dew_point',
	unit: '°C',
	quality: 'unavailable',
	current_value: null,
	expires_at: null,
	errors: ['relative_humidity:missing'],
	sources: [
		{ role: 'dry_bulb', source_property: 'temperature', source_identity: 'temperature', errors: [], age_seconds: 2 },
		{ role: 'relative_humidity', source_property: null, source_identity: 'deleted-humidity', errors: ['missing'], age_seconds: null },
	],
});
function editor(outputId?: string) {
	let authoring!: ReturnType<typeof useDewPointAuthoring>;
	const wrapper = mount(
		defineComponent({
			setup() {
				authoring = useDewPointAuthoring(outputId);
				return () => null;
			},
		})
	);
	return { authoring, wrapper };
}
beforeEach(() => vi.resetAllMocks());
describe('dedicated dew point authoring lifecycle', () => {
	it('preserves missing identities and exact output on repair, using current revisions without promoting preview quality', async () => {
		client.GET.mockResolvedValue({ data: { data: state() } });
		const { authoring: a, wrapper } = editor('retained-output');
		await flushPromises();
		expect(a.current.value?.sources[1].source_identity).toBe('deleted-humidity');
		expect(a.model.humidity).toBeNull();
		client.POST.mockResolvedValue({ data: { data: state() } });
		await a.check();
		expect(a.canSave.value).toBe(true);
		expect(a.preview.value?.quality).toBe('unavailable');
		expect(client.POST.mock.calls[0][1].body.sources[1].source_property).toBeNull();
		a.model.humidity = 'replacement-humidity';
		expect(a.canSave.value).toBe(false);
		await a.save();
		expect(client.PUT).not.toHaveBeenCalled();
		await a.check();
		client.PUT.mockResolvedValue({ data: { data: { ...state(), revision: 8 } } });
		await a.save();
		expect(client.PUT.mock.calls[0][0]).toBe('/plugins/devices-virtual/producers/dew-points/{id}');
		expect(client.PUT.mock.calls[0][1]).toMatchObject({
			params: { path: { id: 'retained-output' } },
			body: {
				expected_revision: 7,
				expected_graph_revision: 12,
				sources: [
					{ role: 'dry_bulb', source_property: 'temperature' },
					{ role: 'relative_humidity', source_property: 'replacement-humidity' },
				],
			},
		});
		wrapper.unmount();
	});
	it('atomically creates a dedicated two-input producer after an exact draft preview', async () => {
		const { authoring: a, wrapper } = editor();
		Object.assign(a.model, { name: 'Dew point', dryBulb: 't', humidity: 'rh' });
		client.POST.mockResolvedValueOnce({ data: { data: { ...state(), revision: 0 } } }).mockResolvedValueOnce({
			data: { data: { device: { id: 'created-device' } } },
		});
		await a.check();
		expect(a.canSave.value).toBe(true);
		expect(await a.save()).toBe('created-device');
		const [path, { body }] = client.POST.mock.calls[1];
		expect(path).toBe('/plugins/devices-virtual/producers/dew-points');
		expect(body.configuration).toMatchObject({
			formula_version: 'magnus-water-17.62-243.12-v1',
			expected_revision: 0,
			expected_graph_revision: 12,
			sources: [
				{ role: 'dry_bulb', source_property: 't' },
				{ role: 'relative_humidity', source_property: 'rh' },
			],
		});
		expect(body.output_property).toBe(client.POST.mock.calls[0][1].body.output_property);
		expect(body.device.channels[0].category).toBe('analog_input');
		expect(a.canSave.value).toBe(false);
		wrapper.unmount();
	});
	it('discards an in-flight preview after a source edit, then refuses writes until a new preview', async () => {
		let resolve!: (value: unknown) => void;
		client.POST.mockReturnValue(
			new Promise((done) => {
				resolve = done;
			})
		);
		const { authoring: a, wrapper } = editor();
		Object.assign(a.model, { name: 'Dew point', dryBulb: 't', humidity: 'rh' });
		const pending = a.check();
		a.model.humidity = 'new-rh';
		resolve({ data: { data: state() } });
		await pending;
		expect(a.preview.value).toBeNull();
		expect(a.canSave.value).toBe(false);
		await a.save();
		expect(client.POST).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});
	it('refuses missing create inputs and clears save approval on failed configuration revision', async () => {
		const { authoring: a, wrapper } = editor();
		a.model.name = 'Dew point';
		await a.check();
		expect(a.error.value).toBe('inputs');
		expect(client.POST).not.toHaveBeenCalled();
		Object.assign(a.model, { dryBulb: 't', humidity: 'rh' });
		client.POST.mockResolvedValueOnce({ data: { data: state() } });
		await a.check();
		client.POST.mockResolvedValueOnce({ error: { message: 'revision changed' } });
		await a.save();
		expect(a.error.value).toBe('revision');
		expect(a.canSave.value).toBe(false);
		wrapper.unmount();
	});
});
