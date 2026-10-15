import { ElSelect } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import VirtualLightGroupDetail from './virtual-light-group-detail.vue';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), on: vi.fn(), off: vi.fn(), controls: ['on'] as string[] }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../composables/useGroupCatalog', async () => {
	const { ref } = await import('vue');
	return {
		useGroupCatalog: () => ({ catalog: ref(null), profiles: ref([]), pending: ref(false), error: ref(null), load: vi.fn(), invalidate: vi.fn() }),
	};
});
vi.mock('../../../modules/devices/store/keys', () => ({
	devicesStoreKey: 'devices',
	channelsStoreKey: 'channels',
	channelsPropertiesStoreKey: 'properties',
}));
vi.mock('../../../common', () => ({
	useBackend: () => ({ client: mocks }),
	injectSockets: () => ({ on: mocks.on, off: mocks.off }),
	injectStoresManager: () => ({
		getStore: (key: string) => ({
			fetch: () => Promise.resolve(),
			findAll: () =>
				key === 'devices'
					? [
							{ id: 'a', type: 'physical', category: 'lighting' },
							{ id: 'b', type: 'physical', category: 'lighting' },
						]
					: [],
			findById: () => null,
			findForDevice: (id: string) => [{ id: id === 'group' ? 'group-channel' : id, device: id, category: 'light', name: id }],
			findForChannel: (id: string) =>
				mocks.controls.map((category) => ({
					id: `${id}-${category}`,
					channel: id,
					category,
					dataType: category === 'on' ? 'bool' : 'float',
					permissions: ['rw'],
				})),
		}),
	}),
}));
const configuration = {
	group_channel: 'group-channel',
	profile: 'light',
	revision: 1,
	graph_revision: 1,
	common_capabilities: [{ category: 'on', data_type: 'bool', access: 'rw', format: null }],
	members: ['a', 'b'].map((id) => ({
		id,
		source_channel: id,
		source_identity: id,
		bindings: [{ output_property: 'group-channel-on', quantity: 'on', source_property: `${id}-on` }],
	})),
	reported_state: {
		on_count: 1,
		off_count: 1,
		unknown_count: 0,
		total: 2,
		members: [
			{ source_identity: 'a', on: true },
			{ source_identity: 'b', on: false },
		],
		properties: [{ category: 'on', mixed: true, value: true }],
	},
};
const mountDetail = async () => {
	const wrapper = mount(VirtualLightGroupDetail, { props: { device: { id: 'group' } as never } });
	await flushPromises();
	return wrapper;
};
const click = async (wrapper: Awaited<ReturnType<typeof mountDetail>>, label: string) => {
	const button = wrapper.findAll('button').find((candidate) => candidate.text() === `devicesVirtualPlugin.lightGroup.${label}`);
	expect(button).toBeDefined();
	await button!.trigger('click');
	await flushPromises();
};
describe('light group actual state and command detail', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.controls = ['on'];
		mocks.GET.mockResolvedValue({ data: { data: configuration } });
	});
	afterEach(() => vi.restoreAllMocks());
	it('shows partial member outcomes without treating accepted or mixed state as confirmation', async () => {
		mocks.POST.mockResolvedValue({
			data: {
				data: {
					success: false,
					composites: [
						{
							id: 'parent',
							status: 'partial',
							children: [
								{ member_id: 'a', member_identity: 'a', property_id: 'a-on', status: 'confirmed' },
								{ member_id: 'b', member_identity: 'b', property_id: 'b-on', status: 'failed' },
							],
						},
					],
				},
			},
		});
		const wrapper = await mountDetail();
		expect(wrapper.text()).toContain('devicesVirtualPlugin.lightGroup.mixed');
		await click(wrapper, 'turnOn');
		expect(wrapper.text()).toContain('devicesVirtualPlugin.lightGroup.status.partial');
		expect(wrapper.text()).toContain('devicesVirtualPlugin.lightGroup.status.failed');
		expect(mocks.POST).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});
	it('does not retry an uncertain command and releases event handlers on unmount', async () => {
		mocks.POST.mockRejectedValue(new Error('Connection lost after send'));
		const wrapper = await mountDetail();
		await click(wrapper, 'turnOff');
		expect(wrapper.text()).toContain('devicesVirtualPlugin.lightGroup.commandUncertain');
		expect(mocks.POST).toHaveBeenCalledTimes(1);
		expect(mocks.POST.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
		wrapper.unmount();
		expect(mocks.off).toHaveBeenCalledWith('event', expect.any(Function));
	});
	it('sends all RGB components in one command and requires an explicit value for unknown state', async () => {
		mocks.controls = ['on', 'color_red', 'color_green', 'color_blue'];
		const color = ['color_red', 'color_green', 'color_blue'];
		mocks.GET.mockResolvedValue({
			data: {
				data: {
					...configuration,
					common_capabilities: color.map((category) => ({ category, data_type: 'float', access: 'rw', format: [0.125, 1.125], step: 0.25 })),
					members: configuration.members.map((member) => ({
						...member,
						bindings: color.map((quantity) => ({ quantity, output_property: `group-channel-${quantity}` })),
					})),
				},
			},
		});
		mocks.POST.mockResolvedValue({ data: { data: { success: true, composites: [] } } });
		const wrapper = await mountDetail();
		const apply = () => wrapper.findAll('button').find((button) => button.text() === 'devicesVirtualPlugin.lightGroup.apply')!;
		expect(apply().attributes('disabled')).toBeDefined();
		for (const [index, category] of color.entries()) {
			await wrapper.find(`[data-test-id="light-group-control-${category}"] input`).setValue(String([0.6, 0.125, 1.125][index]));
		}
		await apply().trigger('click');
		await flushPromises();
		expect(mocks.POST).toHaveBeenCalledTimes(1);
		expect(mocks.POST.mock.calls[0][1].body.properties).toEqual(
			color.map((category, index) => ({
				device: 'group',
				channel: 'group-channel',
				property: `group-channel-${category}`,
				value: [0.625, 0.125, 1.125][index],
			}))
		);
		expect(mocks.POST.mock.calls[0][1].body.request_id).toEqual(expect.any(String));
		wrapper.unmount();
	});
	it('offers qualified cover COMMAND operations and shows refusals without position/tilt inputs', async () => {
		mocks.controls = ['type', 'status', 'position', 'command'];
		mocks.GET.mockResolvedValue({
			data: {
				data: {
					...configuration,
					profile: 'cover',
					common_capabilities: [
						{ category: 'type', data_type: 'enum', access: 'ro', format: ['blind'] },
						{ category: 'command', data_type: 'enum', access: 'wo', format: ['open', 'close', 'stop'] },
						{ category: 'position', data_type: 'uchar', access: 'rw', format: [0, 100], step: 1 },
					],
					operations: [
						{ operation: 'open', commandable: true, members: [] },
						{ operation: 'close', commandable: false, members: [{ source_identity: 'a', reasons: ['tag_unavailable'] }] },
						{ operation: 'stop', commandable: false, members: [] },
						{ operation: 'position', commandable: false, members: [{ source_identity: 'a', reasons: ['position_completion_unavailable'] }] },
					],
				},
			},
		});
		const wrapper = await mountDetail();
		expect(wrapper.text()).toContain('tag_unavailable');
		expect(wrapper.text()).toContain('position_completion_unavailable');
		expect(wrapper.text()).toContain('devicesVirtualPlugin.lightGroup.coverCommandMeaning');
		expect(wrapper.find('[data-test-id="light-group-control-position"]').exists()).toBe(false);
		const buttons = wrapper.findAll('button');
		expect(buttons.find((button) => button.text() === 'devicesVirtualPlugin.lightGroup.open')?.attributes('disabled')).toBeUndefined();
		expect(buttons.find((button) => button.text() === 'devicesVirtualPlugin.lightGroup.close')?.attributes('disabled')).toBeDefined();
		wrapper.unmount();
	});
	it('distinguishes false, mixed and expired feedback and fences in-flight refresh after disconnect', async () => {
		const actual = {
			...configuration,
			reported_state: {
				...configuration.reported_state,
				properties: [
					{ category: 'on', value: false, mixed: false, contributors: ['a', 'b'], expires_at: new Date(Date.now() + 100000).toISOString() },
					{ category: 'speed', value: null, mixed: true, contributors: ['a', 'b'], expires_at: new Date(Date.now() + 100000).toISOString() },
					{ category: 'swing', value: true, mixed: false, contributors: ['a'], expires_at: new Date(Date.now() - 1).toISOString() },
				],
			},
		};
		mocks.GET.mockResolvedValue({ data: { data: actual } });
		const wrapper = await mountDetail();
		expect(wrapper.text()).toContain('false');
		expect(wrapper.text()).toContain('devicesVirtualPlugin.lightGroup.mixed');
		expect(wrapper.text()).toContain('devicesVirtualPlugin.lightGroup.unknown');
		let resolve!: (result: unknown) => void;
		mocks.GET.mockImplementationOnce(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);
		const connect = mocks.on.mock.calls.find(([event]) => event === 'connect')![1];
		const disconnect = () => mocks.on.mock.calls.filter(([event]) => event === 'disconnect').forEach(([, listener]) => listener());
		connect();
		disconnect();
		resolve({ data: { data: actual } });
		await flushPromises();
		expect(
			wrapper
				.findAll('button')
				.find((button) => button.text() === 'devicesVirtualPlugin.lightGroup.turnOn')
				?.attributes('disabled')
		).toBeDefined();
		expect(wrapper.text()).not.toContain('devicesVirtualPlugin.lightGroup.mixed');
		wrapper.unmount();
	});

	it.each([
		[false, true],
		[true, true],
		[false, false],
		[true, false],
	])('retains stable identities with replacement %s and missing channel %s', async (replace, missingChannel) => {
		const missing = {
			...configuration,
			members: configuration.members.map((member) => ({
				...member,
				source_channel: member.id === 'a' && missingChannel ? null : member.source_channel,
				bindings: member.bindings.map((binding) => ({
					...binding,
					id: `binding-${member.id}`,
					source_property: member.id === 'a' ? null : binding.source_property,
				})),
			})),
		};
		mocks.GET.mockResolvedValue({ data: { data: missing } });
		mocks.POST.mockResolvedValue({ data: { data: missing } });
		mocks.PUT.mockResolvedValue({ data: { data: missing } });
		const wrapper = await mountDetail();
		await click(wrapper, 'editTitle');
		if (replace) {
			wrapper
				.findAllComponents(ElSelect)
				.find((select) => select.attributes('data-test-id') === 'repair-member-a')!
				.vm.$emit('update:modelValue', 'c');
		} else {
			wrapper.findComponent({ name: 'VirtualLightGroupMembers' }).vm.$emit('update:modelValue', ['a', 'b', 'c']);
		}
		await flushPromises();
		await click(wrapper, 'preview');
		const draft = mocks.POST.mock.calls[0][1].body;
		expect(draft.members[0]).toEqual({
			id: 'a',
			source_channel: replace ? 'c' : missingChannel ? null : 'a',
			bindings: [{ id: 'binding-a', output_property: 'group-channel-on', source_property: replace ? 'c-on' : null }],
		});
		expect(draft.members[1]).toMatchObject({ id: 'b', bindings: [{ id: 'binding-b' }] });
		if (!replace)
			expect(draft.members[2]).toEqual({ source_channel: 'c', bindings: [{ output_property: 'group-channel-on', source_property: 'c-on' }] });
		await click(wrapper, 'save');
		expect(mocks.PUT.mock.calls[0][1].body).toEqual(draft);
		wrapper.unmount();
	});
	it.each(['switch', 'outlet', 'fan', 'cover'])('preserves %s profile and every output/binding identity through repair', async (profile) => {
		const fields = profile === 'cover' ? ['type', 'status', 'position', 'command'] : profile === 'fan' ? ['on', 'speed', 'direction'] : ['on'];
		mocks.controls = fields;
		const configured = {
			...configuration,
			profile,
			members: ['a', 'b'].map((id) => ({
				id,
				source_channel: id === 'a' ? null : id,
				source_identity: id,
				bindings: fields.map((quantity) => ({
					id: `${id}-${quantity}`,
					quantity,
					output_property: `group-channel-${quantity}`,
					source_property: id === 'a' ? null : `${id}-${quantity}`,
				})),
			})),
		};
		mocks.GET.mockResolvedValue({ data: { data: configured } });
		mocks.POST.mockResolvedValue({ data: { data: configured } });
		mocks.PUT.mockResolvedValue({ data: { data: configured } });
		const wrapper = await mountDetail();
		await click(wrapper, 'editTitle');
		wrapper
			.findAllComponents(ElSelect)
			.find((select) => select.attributes('data-test-id') === 'repair-member-a')!
			.vm.$emit('update:modelValue', 'c');
		await flushPromises();
		await click(wrapper, 'preview');
		const draft = mocks.POST.mock.calls[0][1].body;
		expect(draft.profile).toBe(profile);
		expect(draft.members[0]).toEqual({
			id: 'a',
			source_channel: 'c',
			bindings: fields.map((quantity) => ({ id: `a-${quantity}`, output_property: `group-channel-${quantity}`, source_property: `c-${quantity}` })),
		});
		await click(wrapper, 'save');
		expect(mocks.PUT.mock.calls[0][1].body).toEqual(draft);
		wrapper.unmount();
	});

	it('keeps save disabled when the server refuses a repair preview', async () => {
		mocks.POST.mockResolvedValue({ error: { message: 'repair scene references' } });
		const wrapper = await mountDetail();
		await click(wrapper, 'editTitle');
		await click(wrapper, 'preview');
		expect(wrapper.text()).toContain('devicesVirtualPlugin.lightGroup.revisionConflict');
		const save = wrapper.findAll('button').find((button) => button.text() === 'devicesVirtualPlugin.lightGroup.save');
		expect(save?.attributes('disabled')).toBeDefined();
		expect(mocks.PUT).not.toHaveBeenCalled();
		wrapper.unmount();
	});
});
