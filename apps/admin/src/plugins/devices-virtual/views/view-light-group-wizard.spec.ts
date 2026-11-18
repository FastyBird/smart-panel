import { ref } from 'vue';

import { ElFormItem, ElRadioGroup } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import VirtualGroupCapabilityMatrix from '../components/virtual-group-capability-matrix.vue';
import VirtualPlacementFields from '../components/virtual-placement-fields.vue';
import VirtualWizardAddSources from '../components/virtual-wizard-add-sources.vue';
import en from '../locales/en-US.json';
import type { GroupCapability, GroupCategory } from '../utils/group-authoring.types';

import Wizard from './view-light-group-wizard.vue';

const mocks = vi.hoisted(() => ({ flashError: vi.fn(), POST: vi.fn(), push: vi.fn(), fetch: vi.fn() }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: translate }) }));
function translate(key: string, params: Record<string, unknown> = {}) {
	const value = key.startsWith('devicesVirtualPlugin.')
		? key
				.slice('devicesVirtualPlugin.'.length)
				.split('.')
				.reduce<unknown>((value, part) => (value as Record<string, unknown>)?.[part], en)
		: undefined;
	return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? '')) : key;
}
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('../../../modules/devices', () => ({ RouteNames: { DEVICE: 'device', DEVICES: 'devices' } }));
vi.mock('../../../modules/devices/store/keys', () => ({
	devicesStoreKey: 'devices',
	channelsStoreKey: 'channels',
	channelsPropertiesStoreKey: 'properties',
}));
vi.mock('../../../modules/spaces/store/keys', () => ({ spacesStoreKey: 'spaces' }));
vi.mock('../../../common', () => ({
	useFlashMessage: () => ({ error: mocks.flashError }),
	useBackend: () => ({ client: mocks }),
	injectStoresManager: () => ({ getStore: (key: string) => stores[key] }),
}));
const propertyState = ref([{ id: 'on', category: 'on', dataType: 'bool', format: null, step: null, permissions: ['rw'], unit: null, value: false }]);
const stores: Record<string, { fetch: typeof mocks.fetch; findAll: () => unknown[] }> = {
	devices: {
		fetch: mocks.fetch,
		findAll: () => [
			{ id: 'device-a', name: 'Couch light', roomId: 'living', zoneIds: ['downstairs'] },
			{ id: 'device-c', name: 'TV light', roomId: 'living', zoneIds: ['downstairs'] },
			{ id: 'device-d', name: 'Dimmer', roomId: 'bedroom', zoneIds: ['downstairs'] },
			{ id: 'device-e', name: 'On-only light', roomId: null, zoneIds: [] },
			{ id: 'device-b', name: 'Incompatible device', roomId: null, zoneIds: [] },
		],
	},
	channels: { fetch: mocks.fetch, findAll: () => ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: 'Light channel' })) },
	properties: { fetch: mocks.fetch, findAll: () => propertyState.value },
	spaces: {
		fetch: mocks.fetch,
		findAll: () => [
			{ id: 'living', name: 'Living Room', type: 'room' },
			{ id: 'bedroom', name: 'Bedroom', type: 'room' },
			{ id: 'downstairs', name: 'Downstairs', type: 'zone', category: 'lighting' },
		],
	},
};
const capability = (category: GroupCategory): GroupCapability => ({
	category,
	data_type: (category === 'on' ? 'bool' : category === 'speed' || category === 'type' ? 'enum' : 'float') as GroupCapability['data_type'],
	access: 'rw' as GroupCapability['access'],
	format: category === 'on' ? null : category === 'speed' ? ['low', 'high'] : category === 'type' ? ['blind'] : [0, 100],
	unit: null,
	step: null,
});
const categories = (profile: string, channel: string): GroupCategory[] => {
	if (channel === 'b') return [];
	if (profile === 'fan') return ['on', 'speed'] as GroupCategory[];
	if (profile === 'cover') return ['type', 'status', 'position', 'command'] as GroupCategory[];
	if (channel === 'e') return ['on'] as GroupCategory[];
	return (channel === 'd' ? ['on', 'brightness'] : ['on', 'brightness', 'color_red', 'color_green', 'color_blue']) as GroupCategory[];
};
const common = (profile: string, channels: string[]) =>
	categories(profile, channels[0]).filter((category) => channels.every((id) => categories(profile, id).includes(category)));
const catalog = (profile: string, selected: string[], requested?: GroupCategory[], excluded: GroupCategory[] = []) => ({
	profiles: ['light', 'switch', 'outlet', 'fan', 'cover'].map((profile) => ({
		profile,
		required_capabilities: profile === 'cover' ? ['type', 'status', 'position', 'command'] : ['on'],
	})),
	candidates: ['a', 'b', 'c', 'd', 'e'].map((channel) => {
		const prospective = common(profile, [...new Set([...selected, channel])]);
		const required = profile === 'cover' ? ['type', 'status', 'position', 'command'] : ['on'];
		const controls = new Set([...required, ...(requested ?? prospective.filter((category) => !excluded.includes(category)))]);
		const reasons = [...controls]
			.filter((category) => !prospective.includes(category as GroupCategory))
			.map((category) => `group_capability_incompatible:${category}`);
		return {
			channel,
			device: `device-${channel}`,
			name: `Candidate ${channel}`,
			eligible: reasons.length === 0,
			reasons,
			common_capabilities: prospective.map(capability),
		};
	}),
	diagnostics: [],
});
let revision = 7;
let view: VueWrapper;
const calls = (suffix: string) => mocks.POST.mock.calls.filter(([path]) => String(path).endsWith(suffix));
const next = async () => {
	await view.get('[data-test-id="wizard-action-next"]').trigger('click');
	await flushPromises();
};
const back = async () => {
	await view.get('[data-test-id="wizard-action-back"]').trigger('click');
	await flushPromises();
};
const openMembers = async () => {
	view = mount(Wizard);
	await flushPromises();
	await view.get('[data-test-id="group-name"]').setValue('Custom group');
	view.getComponent(VirtualPlacementFields).vm.$emit('update:roomId', 'living');
	view.getComponent(VirtualPlacementFields).vm.$emit('update:zoneIds', ['downstairs']);
	await flushPromises();
	await next();
};
const add = async (id: string) => {
	await view.get(`[data-source-id="${id}"]`).trigger('click');
	await flushPromises();
};
const selected = () => view.getComponent(VirtualGroupCapabilityMatrix).props('selectedCapabilities');
const setProfile = async (profile: string) => {
	view.getComponent(ElRadioGroup).vm.$emit('update:modelValue', profile);
	await flushPromises();
};

describe('actuator group three-step authoring', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		revision = 7;
		propertyState.value[0].value = false;
		propertyState.value[0].format = null;
		propertyState.value[0].permissions = ['rw'];
		mocks.fetch.mockResolvedValue(undefined);
		mocks.POST.mockImplementation((path: string, { body }) => {
			if (path.endsWith('light-group-candidates'))
				return Promise.resolve({ data: { data: catalog(body.profile, body.selected_channels, body.capabilities, body.excluded_capabilities) } });
			if (path.endsWith('draft-preview'))
				return Promise.resolve({
					data: {
						data: {
							graph_revision: revision,
							common_capabilities: common(
								body.profile,
								body.members.map((member: { source_channel: string }) => member.source_channel)
							)
								.filter((category) => body.capabilities.includes(category))
								.map(capability),
							unavailable_capabilities: [],
							members: body.members,
						},
					},
				});
			return Promise.resolve({ error: { message: 'Graph revision changed' }, response: { status: 409 } });
		});
	});
	afterEach(() => view?.unmount());

	it('allows additional members to narrow other controls after an optional control is excluded', async () => {
		await openMembers();
		await add('a');
		view.getComponent(VirtualGroupCapabilityMatrix).vm.$emit('toggle', 'brightness', false);
		await flushPromises();
		expect(selected()).toEqual(['on', 'color_red', 'color_green', 'color_blue']);
		const source = view
			.getComponent(VirtualWizardAddSources)
			.props('sources')
			.find((entry) => entry.id === 'e')!;
		expect(source.disabled).toBe(false);
		expect(source.badge?.label).toBe('Removes 3 controls');
		await add('e');
		expect(selected()).toEqual(['on']);
		await next();
		expect(calls('draft-preview').at(-1)?.[1].body.capabilities).toEqual(['on']);
	});

	it('rechecks quarantined candidates against enabled controls without hiding controls that can be restored', async () => {
		const defaultPost = mocks.POST.getMockImplementation()!;
		mocks.POST.mockImplementation((path: string, options) => {
			if (!path.endsWith('light-group-candidates')) return defaultPost(path, options);
			const { body } = options;
			const response = catalog(body.profile, body.selected_channels, body.capabilities, body.excluded_capabilities);
			for (const candidate of response.candidates) {
				const requested =
					body.capabilities ??
					candidate.common_capabilities
						.map((entry: GroupCapability) => entry.category)
						.filter((category: GroupCategory) => !body.excluded_capabilities?.includes(category));
				if ((candidate.channel === 'c' || body.selected_channels.includes('c')) && requested.includes('brightness')) {
					candidate.eligible = false;
					candidate.reasons = ['graph_quarantined'];
				}
			}
			return Promise.resolve({ data: { data: response } });
		});
		await openMembers();
		await add('a');
		const candidate = () =>
			view
				.getComponent(VirtualWizardAddSources)
				.props('sources')
				.find((source) => source.id === 'c')!;
		const matrix = () => view.getComponent(VirtualGroupCapabilityMatrix);
		expect(candidate().disabled).toBe(true);

		matrix().vm.$emit('toggle', 'brightness', false);
		await flushPromises();
		const enabled = ['on', 'color_red', 'color_green', 'color_blue'];
		expect(calls('light-group-candidates').at(-1)?.[1].body).toMatchObject({ excluded_capabilities: ['brightness'] });
		expect(calls('light-group-candidates').at(-1)?.[1].body).not.toHaveProperty('capabilities');
		expect(candidate().disabled).toBe(false);
		expect(candidate().disabledReason).toBeUndefined();
		expect(
			matrix()
				.props('availableCapabilities')
				.map((entry) => entry.category)
		).toContain('brightness');

		matrix().vm.$emit('toggle', 'brightness', true);
		await flushPromises();
		expect(candidate().disabled).toBe(true);
		expect(selected()).toContain('brightness');

		matrix().vm.$emit('toggle', 'brightness', false);
		await flushPromises();
		await add('c');
		expect(
			matrix()
				.props('members')
				.map((member) => member.id)
		).toEqual(['a', 'c']);
		expect(calls('light-group-candidates').at(-1)?.[1].body.excluded_capabilities).toEqual(['brightness']);
		await next();
		expect(calls('draft-preview').at(-1)?.[1].body.capabilities).toEqual(enabled);
		expect(view.get('[data-test-id="group-review-controls"]').text()).not.toContain('brightness');
	});

	it('uses the current capability contract when a previously quarantined candidate becomes eligible', async () => {
		mocks.POST.mockImplementation((path: string, { body }) => {
			const response = catalog(body.profile, body.selected_channels);
			const candidate = response.candidates.find((candidate) => candidate.channel === 'b')!;
			candidate.eligible = body.selected_channels.length > 0;
			candidate.reasons = candidate.eligible ? [] : ['graph_quarantined'];
			return Promise.resolve({ data: { data: response } });
		});
		await openMembers();
		expect(
			view
				.getComponent(VirtualWizardAddSources)
				.props('sources')
				.find((source) => source.id === 'b')?.disabled
		).toBe(true);
		await add('d');
		const candidate = view
			.getComponent(VirtualWizardAddSources)
			.props('sources')
			.find((source) => source.id === 'b')!;
		expect(candidate.disabled).toBe(false);
		expect(candidate.disabledReason).toBeUndefined();
		await add('b');
		expect(
			view
				.getComponent(VirtualGroupCapabilityMatrix)
				.props('members')
				.map((member) => member.id)
		).toContain('b');
	});
	it('validates the name first, offers five kinds and never derives the name from placement or kind', async () => {
		view = mount(Wizard);
		await flushPromises();
		expect(view.getComponent({ name: 'DeviceWizardSteps' }).props('steps')).toHaveLength(3);
		expect(view.findAllComponents({ name: 'ElRadioButton' })).toHaveLength(5);
		const nameField = view.findAllComponents(ElFormItem).find((field) => field.props('label') === 'devicesModule.fields.devices.name.title')!;
		expect(nameField.props('required')).toBe(true);
		expect(view.get<HTMLInputElement>('[data-test-id="group-name"]').attributes('placeholder')).toBe('devicesModule.fields.devices.name.placeholder');
		await next();
		expect(view.getComponent({ name: 'DeviceWizardSteps' }).props('modelValue')).toBe(0);
		expect(view.findAllComponents(ElFormItem).some((item) => item.props('error') === 'devicesModule.fields.devices.name.validation.required')).toBe(
			true
		);
		view.getComponent(VirtualPlacementFields).vm.$emit('update:roomId', 'living');
		await flushPromises();
		const input = view.get<HTMLInputElement>('[data-test-id="group-name"]');
		expect(input.element.value).toBe('');
		await setProfile('fan');
		expect(input.element.value).toBe('');
		await input.setValue('Custom group');
		await setProfile('cover');
		expect(input.element.value).toBe('Custom group');
		expect(view.text()).toContain('same configured type');
		expect(view.text()).not.toContain('PATCH');
	});

	it('uses grouped shared selection and a capability matrix; adding a dimmer removes unsupported colors', async () => {
		await openMembers();
		expect(view.findAll('[data-source-group]').map((group) => group.attributes('data-source-group'))).toEqual(['room', 'zones', 'other']);
		expect(view.get('[data-source-id="b"]').attributes('disabled')).toBeDefined();
		expect(view.text()).toContain('Missing a compatible control');
		await next();
		expect(view.findAllComponents(ElFormItem).some((item) => item.props('error') === 'devicesModule.wizard.validation.minimumItems')).toBe(true);
		await add('a');
		await add('c');
		expect(selected()).toHaveLength(5);
		expect(view.get('[data-source-id="d"]').element.closest('.source-list__row')?.textContent).toContain('Removes 3 controls');
		expect(calls('light-group-candidates').every(([, options]) => !('capabilities' in options.body))).toBe(true);
		await add('d');
		expect(selected()).toEqual(['on', 'brightness']);
		const matrix = view.getComponent(VirtualGroupCapabilityMatrix);
		expect(matrix.props('members')).toHaveLength(3);
		expect(matrix.props('members')[0].capabilities).toHaveLength(5); // Individual row retains its own full contract.
		expect(matrix.props('members')[2].capabilities).toHaveLength(2);
		await view.get('[data-remove-member="d"]').trigger('click');
		await flushPromises();
		expect(selected()).toHaveLength(5);
	});

	it('toggles RGB together, refreshes eligibility, preserves required controls and reviews only the chosen controls', async () => {
		await openMembers();
		await add('a');
		await add('c');
		const before = calls('light-group-candidates').length;
		view.getComponent(VirtualGroupCapabilityMatrix).vm.$emit('toggle', 'color_green', false);
		await flushPromises();
		expect(selected()).toEqual(['on', 'brightness']);
		view.getComponent(VirtualGroupCapabilityMatrix).vm.$emit('toggle', 'on', false);
		await flushPromises();
		expect(selected()).toContain('on');
		expect(calls('light-group-candidates')).toHaveLength(before + 1);
		expect(calls('light-group-candidates').at(-1)?.[1].body.excluded_capabilities).toEqual(['color_red', 'color_green', 'color_blue']);
		await next();
		expect(calls('draft-preview')).toHaveLength(1);
		expect(calls('draft-preview')[0][1].body.capabilities).toEqual(['on', 'brightness']);
		expect(view.get('[data-test-id="group-review-controls"]').text()).not.toContain('color_green');
		expect(view.get('[data-test-id="group-review-controls"]').text()).toContain('0 – 100');
		expect(view.find('[data-source-id]').exists()).toBe(false);
		expect(view.find('.virtual-wizard-layout__aside').exists()).toBe(false);
	});

	it('clears selected members on kind change and restores an unconstrained catalogue when all members are removed', async () => {
		await openMembers();
		await add('d');
		await view.get('[data-remove-member="d"]').trigger('click');
		await flushPromises();
		expect(calls('light-group-candidates').at(-1)?.[1].body.selected_channels).toEqual([]);
		await add('a');
		await add('c');
		await back();
		mocks.POST.mockClear();
		await setProfile('fan');
		expect(calls('light-group-candidates')).toHaveLength(1);
		expect(calls('light-group-candidates')[0][1].body).toEqual({ profile: 'fan', selected_channels: [] });
		await next();
		expect(view.getComponent(VirtualWizardAddSources).props('selectedIds')).toEqual([]);
		await add('a');
		await add('c');
		await next();
		expect(view.get('[data-test-id="group-review-controls"]').text()).toContain('low, high');
	});

	it('ignores live value updates, keeps a refused create stable, and refreshes approval only after editing', async () => {
		await openMembers();
		await add('a');
		await add('c');
		const count = calls('light-group-candidates').length;
		propertyState.value[0].value = true;
		await flushPromises();
		expect(calls('light-group-candidates')).toHaveLength(count);
		await next();
		revision = 8;
		propertyState.value[0].permissions = ['r']; // Metadata drift during Review must not replace the approved snapshot.
		await flushPromises();
		await view.get('[data-test-id="wizard-action-create"]').trigger('click');
		await flushPromises();
		expect(calls('/light-groups')[0][1].body.expected_graph_revision).toBe(7);
		expect(calls('draft-preview')).toHaveLength(1);
		expect(calls('light-group-candidates')).toHaveLength(count);
		expect(mocks.flashError).toHaveBeenCalledWith('Graph revision changed');
		expect(view.find('.el-alert--error').exists()).toBe(false);
		expect(view.get('[data-test-id="group-review-controls"]').text()).toContain('brightness');
		await back();
		await next();
		await view.get('[data-test-id="wizard-action-create"]').trigger('click');
		await flushPromises();
		expect(calls('/light-groups')[1][1].body.expected_graph_revision).toBe(8);
		expect(calls('draft-preview')).toHaveLength(2);
	});
});
