/* eslint-disable vue/one-component-per-file */
import { defineComponent, h, ref, watch } from 'vue';

import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager } from '../../../../common';
import { AutomationMode, AutomationTemplateParameterType, AutomationTemplateSource } from '../../automations.constants';
import { takeAutomationDraft } from '../../automations.drafts';
import type { IAutomationTemplate } from '../../store/templates.store.types';

import AutomationTemplateDialog from './automation-template-dialog.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
		te: () => false,
	}),
}));

vi.mock('../../../../common', async () => {
	const actual = await vi.importActual('../../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useFlashMessage: vi.fn(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() })),
	};
});

const DEVICE = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01';
const CHANNEL = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a02';
const PROPERTY = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a03';

const parameter = (overrides: Partial<IAutomationTemplate['parameters'][number]>): IAutomationTemplate['parameters'][number] => ({
	id: 'x',
	type: AutomationTemplateParameterType.text,
	label: 'X',
	description: null,
	access: null,
	channelCategories: [],
	propertyCategories: [],
	dataTypes: [],
	min: null,
	max: null,
	step: null,
	unit: null,
	maxLength: null,
	default: null,
	...overrides,
});

const leakAlarm: IAutomationTemplate = {
	id: 'leak-alarm',
	name: 'Leak alarm',
	description: 'Sends a notification when water is detected.',
	icon: 'mdi:water-alert',
	mode: AutomationMode.restart,
	source: AutomationTemplateSource.builtin,
	parameters: [
		parameter({
			id: 'leak',
			type: AutomationTemplateParameterType.property,
			label: 'Leak sensor',
			access: 'readable',
			channelCategories: ['leak'],
			propertyCategories: ['detected'],
		}),
		parameter({ id: 'title', label: 'Notification title', maxLength: 120, default: 'Water leak detected' }),
	],
};

const graph = { version: 1, nodes: [{ id: 'n1', type: 'device.property.changed', position: { x: 0, y: 0 }, config: {} }], edges: [] };

// The picker of the devices module is not what is tested here: it reports a chosen property at once
const TargetStub = defineComponent({
	name: 'AutomationNodeTarget',
	props: {
		deviceId: { type: String, default: null },
		channelId: { type: String, default: null },
		propertyId: { type: String, default: null },
		access: { type: String, default: undefined },
		propertyFilter: { type: Function, default: undefined },
		prefix: { type: String, default: '' },
		errors: { type: Array, default: () => [] },
	},
	emits: ['change'],
	setup(props, { emit }) {
		return () =>
			h(
				'button',
				{
					'data-test-id': 'pick-property',
					'data-access': props.access,
					onClick: () => emit('change', { device_id: DEVICE, channel_id: CHANNEL, property_id: PROPERTY }, 'property'),
				},
				(props.errors as string[]).join(' ')
			);
	},
});

// The dialog of Element Plus renders into the body once opened; the stub renders in place and says it opened
const DialogStub = defineComponent({
	name: 'ElDialog',
	props: { modelValue: { type: Boolean, default: false }, title: { type: String, default: '' } },
	emits: ['open', 'update:modelValue'],
	setup(props, { emit, slots }) {
		watch(
			(): unknown => props.modelValue,
			(visible: unknown): void => {
				if (visible) emit('open');
			}
		);

		return () => (props.modelValue ? h('div', { class: 'dialog-stub' }, [slots.default?.(), slots.footer?.()]) : null);
	},
});

describe('AutomationTemplateDialog', () => {
	let wrapper: VueWrapper;
	let fetch: Mock;
	let generate: Mock;
	const loaded = ref<boolean>(false);

	const channel = (id: string) => (id === CHANNEL ? { id, category: 'leak' } : { id, category: 'light' });

	beforeEach(() => {
		loaded.value = false;

		fetch = vi.fn(() => {
			loaded.value = true;

			return Promise.resolve([leakAlarm]);
		});
		generate = vi.fn().mockResolvedValue({ name: 'Leak alarm', mode: AutomationMode.restart, graph });

		const templatesStore = {
			findAll: () => (loaded.value ? [leakAlarm] : []),
			fetching: () => false,
			firstLoadFinished: () => loaded.value,
			fetch,
			generate,
		};

		(injectStoresManager as Mock).mockReturnValue({
			getStore: () => ({ ...templatesStore, findById: channel }),
		});
	});

	afterEach(() => {
		wrapper?.unmount();
	});

	const open = async (): Promise<void> => {
		wrapper = mount(AutomationTemplateDialog, {
			props: { visible: false },
			global: { stubs: { ElDialog: DialogStub, AutomationNodeTarget: TargetStub } },
		});

		await wrapper.setProps({ visible: true });
		await flushPromises();
	};

	it('reads the templates when it opens and offers each of them', async () => {
		await open();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(wrapper.find('[data-test-template="leak-alarm"]').text()).toContain('Leak alarm');
	});

	it('reads the catalogue again each time it opens, keeping the list it holds meanwhile', async () => {
		await open();

		await wrapper.setProps({ visible: false });
		await wrapper.setProps({ visible: true });
		await flushPromises();

		// The backend may have restarted with other templates since
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(wrapper.find('[data-test-id="templates-loading"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-template="leak-alarm"]').exists()).toBe(true);
	});

	it('keeps offering the list it holds when reading it again fails', async () => {
		await open();

		fetch.mockRejectedValueOnce(new Error('offline'));

		await wrapper.setProps({ visible: false });
		await wrapper.setProps({ visible: true });
		await flushPromises();

		expect(wrapper.find('[data-test-id="templates-load-failed"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-template="leak-alarm"]').exists()).toBe(true);
	});

	it('asks the questions of the picked template and generates its flow under the id of the new automation', async () => {
		await open();

		await wrapper.find('[data-test-template="leak-alarm"]').trigger('click');

		expect(wrapper.find('[data-test-id="automation-template-form"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="pick-property"]').attributes('data-access')).toBe('readable');
		expect((wrapper.find('input[name="title"]').element as HTMLInputElement).value).toBe('Water leak detected');

		const proceed = wrapper.find('[data-test-id="template-continue"]');

		expect(proceed.attributes('disabled')).toBeDefined();

		await wrapper.find('[data-test-id="pick-property"]').trigger('click');

		expect(proceed.attributes('disabled')).toBeUndefined();

		await proceed.trigger('click');
		await flushPromises();

		expect(generate).toHaveBeenCalledWith({
			id: 'leak-alarm',
			parameters: { leak: { device_id: DEVICE, channel_id: CHANNEL, property_id: PROPERTY }, title: 'Water leak detected' },
		});

		const [[id]] = wrapper.emitted('generated') as [[string]];

		expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false]);
		expect(takeAutomationDraft(id)).toEqual({ name: 'Leak alarm', mode: AutomationMode.restart, graph });
	});

	it('keeps a picker to the channels of the kinds the question takes', async () => {
		await open();

		await wrapper.find('[data-test-template="leak-alarm"]').trigger('click');

		const filter = wrapper.findComponent(TargetStub).props('propertyFilter') as (property: object) => boolean;

		expect(filter({ category: 'detected', dataType: 'bool', channel: CHANNEL })).toBe(true);
		expect(filter({ category: 'detected', dataType: 'bool', channel: 'other' })).toBe(false);
		expect(filter({ category: 'on', dataType: 'bool', channel: CHANNEL })).toBe(false);
	});

	it('goes back to the templates and stashes nothing when it is cancelled', async () => {
		await open();

		await wrapper.find('[data-test-template="leak-alarm"]').trigger('click');
		await wrapper.find('[data-test-id="template-back"]').trigger('click');

		expect(wrapper.find('[data-test-template="leak-alarm"]').exists()).toBe(true);

		await wrapper.find('[data-test-id="template-cancel"]').trigger('click');

		expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false]);
		expect(wrapper.emitted('generated')).toBeUndefined();
		expect(generate).not.toHaveBeenCalled();
	});
});
