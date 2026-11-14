/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, watch } from 'vue';

import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager } from '../../../../common';
import { AutomationMode, AutomationReferenceKind } from '../../automations.constants';
import { automationTransferStoreKey, automationsStoreKey } from '../../store/keys';
import type { IAutomationImportPreparation } from '../../store/transfer.store.types';

import AutomationImportDialog from './automation-import-dialog.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../common', async () => {
	const actual = await vi.importActual('../../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useFlashMessage: vi.fn(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() })),
	};
});

const SCENE = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a10';
const OTHER_SCENE = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a11';
const OLD_SCENE = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a12';
const PROPERTY = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a20';
const DEVICE = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01';
const CHANNEL = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a02';
const NEW_PROPERTY = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a03';
const CREATED = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a99';

const ensure = { ensureDevices: vi.fn(), ensureScenes: vi.fn(), ensureAutomations: vi.fn() };

vi.mock('../../../devices/composables/useDevices', () => ({ useDevices: () => ({ devices: computed(() => []) }) }));
vi.mock('../../../scenes/composables/useScenes', () => ({
	useScenes: () => ({ scenes: computed(() => [{ id: OTHER_SCENE, name: 'Evening' }]) }),
}));
vi.mock('../../composables/useAutomationSpaces', () => ({
	useAutomationSpaces: () => ({ spacesOptions: computed(() => []), fetchSpaces: () => Promise.resolve() }),
}));
vi.mock('../../composables/useAutomations', () => ({ useAutomations: () => ({ automations: computed(() => []) }) }));
vi.mock('../../composables/useAutomationNodeLookups', () => ({ useAutomationNodeLookups: () => ensure }));

const graph = { version: 1, nodes: [{ id: 'run', type: 'scene.run', position: { x: 0, y: 0 }, config: { scene_id: SCENE } }], edges: [] };

const preparation: IAutomationImportPreparation = {
	draft: { name: 'Evening', description: null, icon: null, mode: AutomationMode.restart, spaceId: null, graph },
	missingReferences: [
		{ kind: AutomationReferenceKind.scene, id: SCENE, usages: [{ nodeId: 'run', field: 'scene_id' }], remappable: true },
		{ kind: AutomationReferenceKind.property, id: PROPERTY, usages: [{ nodeId: 'watch', field: 'property_id' }], remappable: true },
		{ kind: AutomationReferenceKind.channel, id: CHANNEL, usages: [{ nodeId: 'odd', field: 'channel_id' }], remappable: true },
		{ kind: AutomationReferenceKind.scene, id: OLD_SCENE, usages: [{ nodeId: 'legacy', field: null }], remappable: false },
	],
	issues: [{ severity: 'error', code: 'invalid_config', message: 'Choose a scene.', blocking: false, node_id: 'run' }],
};

// The picker of the devices module is not what is tested here: it reports a chosen property at once
const TargetStub = defineComponent({
	name: 'AutomationNodeTarget',
	props: {
		deviceId: { type: String, default: null },
		channelId: { type: String, default: null },
		propertyId: { type: String, default: null },
		prefix: { type: String, default: '' },
	},
	emits: ['change'],
	setup(_, { emit }) {
		return () =>
			h('button', {
				'data-test-id': 'pick-property',
				onClick: () => emit('change', { device_id: DEVICE, channel_id: CHANNEL, property_id: NEW_PROPERTY }, 'property'),
			});
	},
});

// A select that picks its first option when clicked
const SelectStub = defineComponent({
	name: 'ElSelect',
	props: { modelValue: { type: String, default: undefined }, name: { type: String, default: '' }, disabled: { type: Boolean, default: false } },
	emits: ['update:modelValue'],
	setup(props, { emit, slots }) {
		return () =>
			h('div', { 'data-test-select': props.name, 'data-value': props.modelValue ?? '' }, [
				h('button', { 'data-test-id': 'pick-option', onClick: () => emit('update:modelValue', OTHER_SCENE) }),
				slots.default?.(),
			]);
	},
});

const OptionStub = defineComponent({
	name: 'ElOption',
	props: { value: { type: String, default: '' }, label: { type: String, default: '' } },
	setup(props) {
		return () => h('span', { 'data-option': props.value }, props.label);
	},
});

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

describe('AutomationImportDialog', () => {
	let wrapper: VueWrapper;
	let prepareImport: Mock;
	let add: Mock;

	beforeEach(() => {
		vi.clearAllMocks();

		prepareImport = vi.fn().mockResolvedValue(preparation);
		add = vi.fn().mockResolvedValue({ id: CREATED, name: 'Evening' });

		const stores = new Map<symbol, unknown>([
			[automationTransferStoreKey, { prepareImport }],
			[automationsStoreKey, { add }],
		]);

		(injectStoresManager as Mock).mockReturnValue({ getStore: (key: symbol) => stores.get(key) });
	});

	afterEach(() => {
		wrapper?.unmount();
	});

	const open = async (): Promise<void> => {
		wrapper = mount(AutomationImportDialog, {
			props: { visible: false },
			global: { stubs: { ElDialog: DialogStub, ElSelect: SelectStub, ElOption: OptionStub, AutomationNodeTarget: TargetStub } },
		});

		await wrapper.setProps({ visible: true });
		await flushPromises();
	};

	it('reads what a reference can be pointed at only once it opens', async () => {
		await open();

		expect(ensure.ensureDevices).toHaveBeenCalled();
		expect(ensure.ensureScenes).toHaveBeenCalled();
		expect(ensure.ensureAutomations).toHaveBeenCalled();
	});

	it('checks the pasted file, offers a choice for each missing reference and imports the automation', async () => {
		await open();

		const proceed = wrapper.find('[data-test-id="import-continue"]');

		expect(proceed.attributes('disabled')).toBeDefined();

		await wrapper.find('textarea').setValue('version: 1\nkind: automation\n');

		expect(proceed.attributes('disabled')).toBeUndefined();

		await proceed.trigger('click');
		await flushPromises();

		expect(prepareImport).toHaveBeenCalledWith({ yaml: 'version: 1\nkind: automation\n' });
		expect(wrapper.find('[data-test-id="import-name"]').text()).toBe('Evening');
		expect(wrapper.find('[data-test-id="import-warnings"]').text()).toContain('run: Choose a scene.');

		const scene = wrapper.find(`[data-test-reference="scene:${SCENE}"]`);
		const property = wrapper.find(`[data-test-reference="property:${PROPERTY}"]`);
		const channel = wrapper.find(`[data-test-reference="channel:${CHANNEL}"]`);

		expect(scene.text()).toContain('automations.transfer.kinds.scene');
		expect(channel.text()).toContain('automations.transfer.texts.notRemappable');
		// A card that does not say where it holds the scene offers no choice for it
		expect(wrapper.find(`[data-test-reference="scene:${OLD_SCENE}"]`).find('[data-test-select]').exists()).toBe(false);
		expect(wrapper.find(`[data-test-reference="scene:${OLD_SCENE}"]`).text()).toContain('automations.transfer.texts.notRemappable');

		await scene.find('[data-test-id="pick-option"]').trigger('click');
		await property.find('[data-test-id="pick-property"]').trigger('click');

		expect(scene.find('[data-test-select]').attributes('data-value')).toBe(OTHER_SCENE);

		await wrapper.find('[data-test-id="import-create"]').trigger('click');
		await flushPromises();

		expect(prepareImport).toHaveBeenLastCalledWith({
			yaml: 'version: 1\nkind: automation\n',
			mappings: [
				{ kind: AutomationReferenceKind.scene, id: SCENE, to: OTHER_SCENE },
				{ kind: AutomationReferenceKind.property, id: PROPERTY, to: NEW_PROPERTY },
			],
		});
		expect(add).toHaveBeenCalledWith({ data: expect.objectContaining({ name: 'Evening', enabled: false, graph }) });
		expect(wrapper.emitted('imported')).toEqual([[CREATED]]);
		expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false]);
	});

	it('locks every choice while the import is on its way, so what is shown is what is imported', async () => {
		let created: (value: { id: string; name: string }) => void = () => undefined;

		add.mockReturnValueOnce(
			new Promise((resolve) => {
				created = resolve;
			})
		);

		await open();

		await wrapper.find('textarea').setValue('version: 1');
		await wrapper.find('[data-test-id="import-continue"]').trigger('click');
		await flushPromises();

		const scene = wrapper.find(`[data-test-reference="scene:${SCENE}"]`);

		await scene.find('[data-test-id="pick-option"]').trigger('click');

		expect(wrapper.findComponent(SelectStub).props('disabled')).toBe(false);

		await wrapper.find('[data-test-id="import-create"]').trigger('click');
		await flushPromises();

		expect(wrapper.findComponent(SelectStub).props('disabled')).toBe(true);
		expect(wrapper.find('[data-test-id="import-property-target"]').attributes('inert')).toBeDefined();

		// A pick that gets through anyway changes nothing
		await wrapper.find('[data-test-id="pick-property"]').trigger('click');
		wrapper.findComponent(SelectStub).vm.$emit('update:modelValue', undefined);
		await flushPromises();

		expect(scene.find('[data-test-select]').attributes('data-value')).toBe(OTHER_SCENE);

		created({ id: CREATED, name: 'Evening' });
		await flushPromises();

		expect(prepareImport).toHaveBeenLastCalledWith({
			yaml: 'version: 1',
			mappings: [{ kind: AutomationReferenceKind.scene, id: SCENE, to: OTHER_SCENE }],
		});
		expect(wrapper.emitted('imported')).toEqual([[CREATED]]);
	});

	it('shows why the backend refused the file and stays on it', async () => {
		const { AutomationsImportInvalidException } = await import('../../automations.exceptions');

		prepareImport.mockRejectedValueOnce(new AutomationsImportInvalidException('bad', [{ field: 'version', reason: 'Unknown version.' }]));

		await open();

		await wrapper.find('textarea').setValue('version: 9');
		await wrapper.find('[data-test-id="import-continue"]').trigger('click');
		await flushPromises();

		expect(wrapper.find('[data-test-id="import-problem"]').text()).toContain('version: Unknown version.');
		expect(wrapper.find('[data-test-id="import-create"]').exists()).toBe(false);
	});

	it('goes back to the file and forgets the choices made', async () => {
		await open();

		await wrapper.find('textarea').setValue('version: 1');
		await wrapper.find('[data-test-id="import-continue"]').trigger('click');
		await flushPromises();

		await wrapper.find('[data-test-id="import-back"]').trigger('click');

		expect(wrapper.find('textarea').exists()).toBe(true);
		expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('version: 1');
	});
});
