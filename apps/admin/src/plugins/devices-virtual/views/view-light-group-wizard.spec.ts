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
	it('loads profiles from backend, presents diagnostics and invalidates the previous profile preview', async () => {
		const wrapper = mount(Wizard);
		await flushPromises();
		const select = wrapper.findAllComponents(ElSelect).find((select) => select.attributes('data-test-id') === 'group-profile')!;
		expect(select.findAllComponents({ name: 'ElOption' })).toHaveLength(5);
		select.vm.$emit('update:modelValue', 'fan');
		await flushPromises();
		wrapper.findComponent({ name: 'VirtualLightGroupMembers' }).vm.$emit('update:modelValue', ['a', 'b']);
		await flushPromises();
		await button(wrapper, 'preview').trigger('click');
		await flushPromises();
		expect(mocks.POST).toHaveBeenCalledWith(
			expect.stringContaining('draft-preview'),
			expect.objectContaining({ body: expect.objectContaining({ profile: 'fan' }) })
		);
		expect(wrapper.text()).toContain('low, high');
		select.vm.$emit('update:modelValue', 'cover');
		await flushPromises();
		expect(wrapper.findComponent({ name: 'VirtualLightGroupMembers' }).props('modelValue')).toEqual([]);
		expect(button(wrapper, 'create').attributes('disabled')).toBeDefined();
		expect(wrapper.text()).toContain('devicesVirtualPlugin.lightGroup.coverTypeGuide');
		expect(wrapper.findComponent({ name: 'VirtualLightGroupMembers' }).props('candidates')[1]).toMatchObject({
			eligible: false,
			label: expect.stringContaining('cover_contract_type_incompatible'),
		});
		wrapper.unmount();
	});
});
