import { type Ref, computed, defineComponent, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager } from '../../../../common';
import { devicesStoreKey } from '../../../devices/store/keys';
import { scenesStoreKey } from '../../../scenes/store/keys';
import { AutomationNodeKind } from '../../automations.constants';
import { automationsStoreKey } from '../../store/keys';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

import AutomationAutomationTargetForm from './automation-automation-target-form.vue';
import AutomationDeviceButtonPressedForm from './automation-device-button-pressed-form.vue';
import AutomationDeviceConnectionChangedForm from './automation-device-connection-changed-form.vue';
import AutomationDevicePropertyChangedForm from './automation-device-property-changed-form.vue';
import AutomationDevicePropertyCompareForm from './automation-device-property-compare-form.vue';
import AutomationDevicePropertySetForm from './automation-device-property-set-form.vue';
import AutomationSceneRunForm from './automation-scene-run-form.vue';
import AutomationSceneWasRunForm from './automation-scene-was-run-form.vue';
import AutomationSecurityArmForm from './automation-security-arm-form.vue';
import AutomationWaitUntilForm from './automation-wait-until-form.vue';

/*
 * The forms read the devices, scenes and automations through the lookups of the cards, here over stores that
 * keep only what the lookups and the pickers look at: the items, whether they were loaded, and whether a
 * read of them is under way.
 */

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
		te: () => false,
	}),
}));

vi.mock('vue-router', async (importOriginal) => ({
	...(await importOriginal<typeof import('vue-router')>()),
	useRoute: () => ({ params: { id: 'a-edited' } }),
}));

vi.mock('../../../../common', async () => {
	const actual = await vi.importActual('../../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

interface IFakeCollection {
	items: Ref<{ id: string; name: string }[]>;
	loaded: Ref<boolean>;
	fetching: Ref<boolean>;
	fetch: ReturnType<typeof vi.fn>;
}

const collection = (): IFakeCollection => ({
	items: ref([]),
	loaded: ref(false),
	fetching: ref(false),
	fetch: vi.fn(),
});

const collections = vi.hoisted(() => ({}) as Record<'devices' | 'scenes' | 'automations', IFakeCollection>);

vi.mock('../../../devices/composables/useDevices', () => ({
	useDevices: () => ({
		devices: computed(() => collections.devices.items.value),
		areLoading: computed(() => collections.devices.fetching.value),
		loaded: computed(() => collections.devices.loaded.value),
	}),
}));

vi.mock('../../../scenes/composables/useScenes', () => ({
	useScenes: () => ({
		scenes: computed(() => collections.scenes.items.value),
		fetching: computed(() => collections.scenes.fetching.value),
	}),
}));

vi.mock('../../composables/useAutomations', () => ({
	useAutomations: () => ({
		automations: computed(() => collections.automations.items.value),
		areLoading: computed(() => collections.automations.fetching.value || !collections.automations.loaded.value),
	}),
}));

const storeOf = (fake: IFakeCollection) => ({
	firstLoadFinished: (): boolean => fake.loaded.value,
	fetching: (): boolean => fake.fetching.value,
	fetch: fake.fetch,
	findById: (id: string) => fake.items.value.find((item) => item.id === id) ?? null,
});

// A read that is under way for a moment, as the stores flag it, and then fails or loads the items
const reads = (fake: IFakeCollection, items: { id: string; name: string }[]): void => {
	fake.fetch
		.mockImplementationOnce(async () => {
			fake.fetching.value = true;
			await Promise.resolve();
			fake.fetching.value = false;

			throw new Error('offline');
		})
		.mockImplementationOnce(async () => {
			fake.fetching.value = true;
			await Promise.resolve();
			fake.items.value = items;
			fake.loaded.value = true;
			fake.fetching.value = false;

			return items;
		});
};

// The picker reads the devices from their stores; here it reads nothing of its own
const DevicePropertyPicker = defineComponent({
	name: 'DevicePropertyPicker',
	props: {
		deviceId: { type: String, default: null },
		channelId: { type: String, default: null },
		propertyId: { type: String, default: null },
		access: { type: String, default: undefined },
		propertyFilter: { type: Function, default: undefined },
		deviceProp: { type: String, default: undefined },
		channelProp: { type: String, default: undefined },
		propertyProp: { type: String, default: undefined },
	},
	emits: ['update:deviceId', 'update:channelId', 'update:propertyId', 'change'],
	template: '<div data-test-id="picker-stub" />',
});

const nodeType = (type: string, kind: AutomationNodeKind): IAutomationNodeType => ({
	type,
	kind,
	name: type,
	description: '',
	ports: { inputs: [], outputs: [] },
	configSchema: { type: 'object' },
});

describe('automation card forms whose lookups fail to load', (): void => {
	let wrapper: VueWrapper | undefined;

	beforeEach((): void => {
		collections.devices = collection();
		collections.scenes = collection();
		collections.automations = collection();

		vi.mocked(injectStoresManager).mockReturnValue({
			getStore: (key: symbol) => {
				if (key === devicesStoreKey) return storeOf(collections.devices);
				if (key === scenesStoreKey) return storeOf(collections.scenes);
				if (key === automationsStoreKey) return storeOf(collections.automations);

				// Channels and properties: nothing is known of them here
				return { findById: () => null };
			},
		} as unknown as ReturnType<typeof injectStoresManager>);
	});

	afterEach((): void => {
		wrapper?.unmount();
		wrapper = undefined;
	});

	const mountForm = async (component: unknown, props: Record<string, unknown>): Promise<VueWrapper> => {
		wrapper = mount(component as Parameters<typeof mount>[0], {
			props,
			global: { stubs: { DevicePropertyPicker, Icon: true } },
		});

		await flushPromises();

		return wrapper;
	};

	const optionValues = (form: VueWrapper, field: string): unknown[] =>
		form
			.find(`[data-test-field="${field}"]`)
			.findComponent({ name: 'ElSelect' })
			.findAllComponents({ name: 'ElOption' })
			.map((option) => option.props('value'));

	it.each([
		{
			name: 'device goes offline or online',
			component: AutomationDeviceConnectionChangedForm,
			type: 'device.connection.changed',
			kind: AutomationNodeKind.trigger,
			collection: 'devices' as const,
			field: 'device_id',
			message: 'automations.editor.fields.device.loadFailed',
		},
		{
			name: 'run scene',
			component: AutomationSceneRunForm,
			type: 'scene.run',
			kind: AutomationNodeKind.action,
			collection: 'scenes' as const,
			field: 'scene_id',
			message: 'automations.editor.fields.scene.loadFailed',
		},
		{
			name: 'scene was run',
			component: AutomationSceneWasRunForm,
			type: 'scene.was-run',
			kind: AutomationNodeKind.trigger,
			collection: 'scenes' as const,
			field: 'scene_id',
			message: 'automations.editor.fields.scene.loadFailed',
		},
		{
			name: 'run automation',
			component: AutomationAutomationTargetForm,
			type: 'automation.run',
			kind: AutomationNodeKind.action,
			collection: 'automations' as const,
			field: 'automation_id',
			message: 'automations.editor.fields.automation.loadFailed',
		},
	])(
		'$name: says when the picker could not be loaded, and loads it again on retry',
		async ({ component, type, kind, collection: name, field, message }) => {
			const fake = collections[name];

			reads(fake, [{ id: 'x-1', name: 'Picked' }]);

			const form = await mountForm(component, { nodeType: nodeType(type, kind), config: {} });

			expect(fake.fetch).toHaveBeenCalledTimes(1);
			expect(form.find(`[data-test-id="${name}-load-failed"]`).text()).toContain(message);
			expect(form.find(`[data-test-id="${name}-load-failed"]`).text()).toContain('automations.buttons.retry.title');
			expect(optionValues(form, field)).toEqual([]);

			await form.find(`[data-test-id="retry-load-${name}"]`).trigger('click');
			await flushPromises();

			expect(fake.fetch).toHaveBeenCalledTimes(2);
			expect(form.find(`[data-test-id="${name}-load-failed"]`).exists()).toBe(false);
			expect(optionValues(form, field)).toEqual(['x-1']);
		}
	);

	it('shows the retry loading while the read is under way', async (): Promise<void> => {
		let finish: () => void = () => undefined;

		collections.scenes.fetch.mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(async () => {
			collections.scenes.fetching.value = true;

			await new Promise<void>((resolve) => {
				finish = resolve;
			});

			collections.scenes.items.value = [{ id: 's-1', name: 'Evening' }];
			collections.scenes.loaded.value = true;
			collections.scenes.fetching.value = false;
		});

		const form = await mountForm(AutomationSceneRunForm, { nodeType: nodeType('scene.run', AutomationNodeKind.action), config: {} });

		await form.find('[data-test-id="retry-load-scenes"]').trigger('click');
		await flushPromises();

		expect(form.find('[data-test-id="retry-load-scenes"]').classes()).toContain('is-loading');

		finish();
		await flushPromises();

		expect(form.find('[data-test-id="scenes-load-failed"]').exists()).toBe(false);
		expect(optionValues(form, 'scene_id')).toEqual(['s-1']);
	});

	it('does not read again while another part of the admin reads, and says when that read fails', async (): Promise<void> => {
		// The summaries of the canvas are reading the devices when the form opens
		collections.devices.fetching.value = true;

		const form = await mountForm(AutomationDeviceConnectionChangedForm, {
			nodeType: nodeType('device.connection.changed', AutomationNodeKind.trigger),
			config: {},
		});

		expect(collections.devices.fetch).not.toHaveBeenCalled();
		expect(form.find('[data-test-id="devices-load-failed"]').exists()).toBe(false);

		collections.devices.fetching.value = false;
		await flushPromises();

		expect(form.find('[data-test-id="devices-load-failed"]').exists()).toBe(true);

		// Read again elsewhere: the failure is said, with the read under way, until it is loaded
		collections.devices.fetching.value = true;
		await flushPromises();

		expect(form.find('[data-test-id="retry-load-devices"]').classes()).toContain('is-loading');

		collections.devices.items.value = [{ id: 'd-1', name: 'Door' }];
		collections.devices.loaded.value = true;
		collections.devices.fetching.value = false;
		await flushPromises();

		expect(collections.devices.fetch).not.toHaveBeenCalled();
		expect(form.find('[data-test-id="devices-load-failed"]').exists()).toBe(false);
		expect(optionValues(form, 'device_id')).toEqual(['d-1']);
	});

	it.each([
		{ name: 'button is pressed', component: AutomationDeviceButtonPressedForm, type: 'device.button.pressed', kind: AutomationNodeKind.trigger },
		{
			name: 'device value changes',
			component: AutomationDevicePropertyChangedForm,
			type: 'device.property.changed',
			kind: AutomationNodeKind.trigger,
		},
		{ name: 'device value is', component: AutomationDevicePropertyCompareForm, type: 'device.property.compare', kind: AutomationNodeKind.condition },
		{ name: 'set device value', component: AutomationDevicePropertySetForm, type: 'device.property.set', kind: AutomationNodeKind.action },
		{ name: 'wait until', component: AutomationWaitUntilForm, type: 'flow.wait-until', kind: AutomationNodeKind.flow },
		{ name: 'arm security', component: AutomationSecurityArmForm, type: 'security.arm', kind: AutomationNodeKind.action },
	])('$name: says when the devices the picker reads could not be loaded, and reads them again on retry', async ({ component, type, kind }) => {
		const fake = collections.devices;

		fake.fetch.mockImplementationOnce(async () => {
			fake.items.value = [{ id: 'd-1', name: 'Door' }];
			fake.loaded.value = true;

			return fake.items.value;
		});

		const form = await mountForm(component, { nodeType: nodeType(type, kind), config: {} });

		expect(form.find('[data-test-id="devices-load-failed"]').exists()).toBe(false);

		// The read the picker starts fails
		fake.fetching.value = true;
		await flushPromises();
		fake.fetching.value = false;
		await flushPromises();

		expect(form.findAll('[data-test-id="devices-load-failed"]').length).toBeGreaterThan(0);

		await form.find('[data-test-id="retry-load-devices"]').trigger('click');
		await flushPromises();

		expect(fake.fetch).toHaveBeenCalledTimes(1);
		expect(form.find('[data-test-id="devices-load-failed"]').exists()).toBe(false);
	});
});
