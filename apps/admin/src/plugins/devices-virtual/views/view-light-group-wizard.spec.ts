import { ElSelect } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import Wizard from './view-light-group-wizard.vue';

const mocks = vi.hoisted(() => ({ POST: vi.fn(), push: vi.fn() }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('../../../modules/devices', () => ({ RouteNames: { DEVICE: 'device', DEVICES: 'devices' } }));
vi.mock('../../../modules/devices/store/keys', () => ({
	devicesStoreKey: 'devices',
	channelsStoreKey: 'channels',
	channelsPropertiesStoreKey: 'properties',
}));
vi.mock('../components/wizard/virtual-wizard-shell.vue', async () => {
	const { defineComponent } = await import('vue');

	return {
		default: defineComponent({
			name: 'VirtualWizardShell',
			props: { busy: Boolean },
			template: '<div><slot /></div>',
		}),
	};
});
vi.mock('../../../modules/spaces/store/keys', () => ({ spacesStoreKey: 'spaces' }));
vi.mock('../../../common', () => ({
	useBackend: () => ({ client: mocks }),
	injectStoresManager: () => ({ getStore: () => ({ fetch: async () => {}, findAll: () => [], findForDevice: () => [] }) }),
}));
const catalog = {
	profiles: ['light', 'switch', 'outlet', 'fan', 'cover'].map((profile) => ({
		profile,
		required_capabilities: profile === 'cover' ? ['type', 'status', 'position', 'command'] : ['on'],
	})),
	candidates: [
		{ channel: 'a', name: 'Compatible physical', eligible: true, reasons: [] },
		{ channel: 'b', name: 'Unconfigured cover', eligible: false, reasons: ['cover_contract_type_incompatible'] },
	],
	diagnostics: [],
};
const preview = {
	graph_revision: 7,
	common_capabilities: [
		{ category: 'on', data_type: 'bool', access: 'rw', format: null, unit: null, step: null },
		{ category: 'speed', data_type: 'enum', access: 'rw', format: ['low', 'high'], unit: null, step: null },
	],
	unavailable_capabilities: [],
	members: [],
};
const button = (wrapper: ReturnType<typeof mount>, name: string) =>
	wrapper.findAll('button').find((button) => button.text() === `devicesVirtualPlugin.lightGroup.${name}`)!;
describe('native group authoring profile selection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.POST.mockImplementation((path: string) => Promise.resolve({ data: { data: path.endsWith('light-group-candidates') ? catalog : preview } }));
	});
	it('loads a new profile once with cleared members but retains ordinary member selections', async () => {
		const wrapper = mount(Wizard);
		await flushPromises();
		const members = wrapper.findComponent({ name: 'VirtualLightGroupMembers' });
		members.vm.$emit('update:modelValue', ['a']);
		await flushPromises();
		expect(members.props('modelValue')).toEqual(['a']);
		const select = wrapper.findAllComponents(ElSelect).find((select) => select.attributes('data-test-id') === 'group-profile')!;
		mocks.POST.mockClear();
		select.vm.$emit('update:modelValue', 'cover');
		await flushPromises();
		const calls = mocks.POST.mock.calls.filter(([path]) => String(path).endsWith('light-group-candidates'));
		expect(calls).toHaveLength(1);
		expect(calls[0][1].body).toMatchObject({ profile: 'cover', selected_channels: [] });
		members.vm.$emit('update:modelValue', ['b']);
		await flushPromises();
		expect(members.props('modelValue')).toEqual(['b']);
		wrapper.unmount();
	});
	it('loads profiles from backend, presents diagnostics and invalidates the previous profile preview', async () => {
		const wrapper = mount(Wizard);
		await flushPromises();
		const select = wrapper.findAllComponents(ElSelect).find((select) => select.attributes('data-test-id') === 'group-profile')!;
		expect(select.findAllComponents({ name: 'ElOption' })).toHaveLength(5);
		select.vm.$emit('update:modelValue', 'fan');
		await flushPromises();
		wrapper.findComponent({ name: 'VirtualLightGroupMembers' }).vm.$emit('update:modelValue', ['a', 'b']);
		await flushPromises();
		// Entering the capabilities step evaluates the selection; there is no separate Preview button.
		const steps = wrapper.findComponent({ name: 'VirtualWizardSteps' });
		steps.vm.$emit('update:modelValue', 2);
		await flushPromises();
		expect(mocks.POST).toHaveBeenCalledWith(
			expect.stringContaining('draft-preview'),
			expect.objectContaining({ body: expect.objectContaining({ profile: 'fan' }) })
		);
		expect(wrapper.text()).toContain('low, high');
		select.vm.$emit('update:modelValue', 'cover');
		await flushPromises();
		expect(wrapper.findComponent({ name: 'VirtualLightGroupMembers' }).props('modelValue')).toEqual([]);
		steps.vm.$emit('update:modelValue', 3);
		await flushPromises();
		expect(button(wrapper, 'create').attributes('disabled')).toBeDefined();
		// The cover guidance belongs to choosing the profile and members, the first two steps.
		steps.vm.$emit('update:modelValue', 0);
		await flushPromises();
		expect(wrapper.text()).toContain('devicesVirtualPlugin.lightGroup.coverTypeGuide');
		expect(wrapper.findComponent({ name: 'VirtualLightGroupMembers' }).props('candidates')[1]).toMatchObject({
			eligible: false,
			label: expect.stringContaining('cover_contract_type_incompatible'),
		});
		wrapper.unmount();
	});
	it('takes a fresh preview after a refused create so the same draft can be retried', async () => {
		let revision = 7;
		mocks.POST.mockImplementation((path: string) => {
			if (path.endsWith('light-group-candidates')) return Promise.resolve({ data: { data: catalog } });
			if (path.endsWith('draft-preview')) return Promise.resolve({ data: { data: { ...preview, graph_revision: revision } } });
			return Promise.resolve({ error: { message: 'Graph revision changed' }, response: { status: 409 } });
		});
		const wrapper = mount(Wizard);
		await flushPromises();
		wrapper.findAllComponents({ name: 'ElInput' })[0].vm.$emit('update:modelValue', 'Group');
		wrapper.findComponent({ name: 'VirtualLightGroupMembers' }).vm.$emit('update:modelValue', ['a', 'b']);
		await flushPromises();
		const steps = wrapper.findComponent({ name: 'VirtualWizardSteps' });
		steps.vm.$emit('update:modelValue', 3);
		await flushPromises();
		const creates = () => mocks.POST.mock.calls.filter(([path]) => String(path).endsWith('/light-groups'));
		revision = 8;
		await button(wrapper, 'create').trigger('click');
		await flushPromises();
		expect(creates()[0]![1]).toMatchObject({ body: { expected_graph_revision: 7 } });
		// The refusal stays visible, and the retry carries the revision of the new preview.
		expect(wrapper.text()).toContain('Graph revision changed');
		await button(wrapper, 'create').trigger('click');
		await flushPromises();
		expect(creates()[1]![1]).toMatchObject({ body: { expected_graph_revision: 8 } });
		wrapper.unmount();
	});
});
