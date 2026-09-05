import { reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import HomeKitSetupWizard from './homekit-setup-wizard.vue';

const mockCandidates = ref([
	{
		id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
		name: 'Living Room Light',
		category: 'lighting',
		roomName: 'Living Room',
		roomId: 'a123f1ee-6c54-4b01-90e6-d701748f0899',
		isCompatible: true,
		suggestedServiceType: 'lightbulb',
		isMapped: true,
		channelsCount: 1,
	},
	{
		id: 'e390f1ee-6c54-4b01-90e6-d701748f0852',
		name: 'Kitchen Thermostat',
		category: 'thermostat',
		roomName: 'Kitchen',
		roomId: 'b123f1ee-6c54-4b01-90e6-d701748f0899',
		isCompatible: true,
		suggestedServiceType: 'thermostat',
		isMapped: false,
		channelsCount: 1,
	},
]);

const mockStatus = ref({
	running: true,
	paired: false,
	pairedClientsCount: 0,
	bridgeName: 'Smart Panel Bridge',
	port: 51826,
	pincode: '031-45-154',
	username: 'CC:22:3D:E3:CE:30',
	setupUri: 'X-HM://0024R932WSP01',
	qrCodeDataUri: 'data:image/svg+xml;utf8,<svg></svg>',
	exposedDevicesCount: 1,
});

const fetchCandidates = vi.fn().mockImplementation(async () => mockCandidates.value);
const fetchStatus = vi.fn().mockImplementation(async () => mockStatus.value);
const mapDevices = vi.fn().mockImplementation(async () => mockCandidates.value);
const resetPairing = vi.fn().mockImplementation(async () => mockStatus.value);

const savingMappingRef = ref(false);
const resettingPairingRef = ref(false);
const fetchingCandidatesRef = ref(false);
const fetchingStatusRef = ref(false);

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

vi.mock('../../../common', () => ({
	useFlashMessage: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../store/homekit-bridge.store', () => ({
	useHomeKitBridge: () =>
		reactive({
			candidates: mockCandidates,
			status: mockStatus,
			fetchingCandidates: fetchingCandidatesRef,
			fetchingStatus: fetchingStatusRef,
			savingMapping: savingMappingRef,
			resettingPairing: resettingPairingRef,
			fetchCandidates,
			fetchStatus,
			mapDevices,
			resetPairing,
		}),
}));

const mountWizard = (props: { visible?: boolean; initialStep?: 'devices' | 'pairing' } = {}) => {
	return mount(HomeKitSetupWizard, {
		props: {
			visible: true,
			initialStep: 'devices',
			...props,
		},
		global: {
			stubs: {
				ElDialog: {
					name: 'ElDialog',
					props: ['width', 'modelValue', 'beforeClose', 'showClose', 'closeOnPressEscape'],
					template: '<div class="el-dialog" :data-show-close="showClose" :data-escape="closeOnPressEscape"><slot /></div>',
				},
				Icon: true,
			},
		},
	});
};

describe('HomeKitSetupWizard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		savingMappingRef.value = false;
		resettingPairingRef.value = false;
		fetchingCandidatesRef.value = false;
		fetchingStatusRef.value = false;
		fetchCandidates.mockImplementation(async () => mockCandidates.value);
		fetchStatus.mockImplementation(async () => mockStatus.value);
		mapDevices.mockImplementation(async () => mockCandidates.value);
		resetPairing.mockImplementation(async () => mockStatus.value);
	});

	it('renders wizard with device candidate rows', async () => {
		const wrapper = mountWizard();
		await flushPromises();

		expect(wrapper.text()).toContain('Living Room Light');
		expect(wrapper.text()).toContain('Kitchen Thermostat');
		expect(wrapper.text()).toContain('lightbulb');
		expect(wrapper.text()).toContain('thermostat');

		const dialog = wrapper.findComponent({ name: 'ElDialog' });
		expect(dialog.props('width')).toBe('90vw');
		expect(dialog.classes()).toContain('max-w-[860px]!');

		const table = wrapper.findComponent({ name: 'ElTable' });
		expect(table.props('maxHeight')).toBe('360px');

		const searchInput = wrapper.findComponent({ name: 'ElInput' });
		expect(searchInput.classes()).toContain('min-w-[240px]');
		expect(searchInput.classes()).toContain('max-w-[380px]');

		const divider = wrapper.findComponent({ name: 'ElDivider' });
		expect(divider.exists()).toBe(true);
		expect(divider.props('direction')).toBe('vertical');

		expect(wrapper.text()).toContain('devicesHomeKitPlugin.wizard.filterDevices');

		const filterSelect = wrapper.findComponent({ name: 'ElSelect' });
		expect(filterSelect.classes()).toContain('w-[180px]!');
		expect(filterSelect.classes()).toContain('shrink-0');
	});

	it('toggles all compatible devices using the header checkbox', async () => {
		const wrapper = mountWizard();
		await flushPromises();

		const checkboxes = wrapper.findAllComponents({ name: 'ElCheckbox' });
		// First checkbox is the header checkbox
		const headerCheckbox = checkboxes[0];
		expect(headerCheckbox).toBeDefined();

		// Initially 1 of 2 compatible devices is selected, so header checkbox is indeterminate
		expect(headerCheckbox.props('indeterminate')).toBe(true);
		expect(headerCheckbox.props('modelValue')).toBe(false);

		// Click header checkbox to select all
		await headerCheckbox.vm.$emit('change', true);
		await flushPromises();

		expect(headerCheckbox.props('indeterminate')).toBe(false);
		expect(headerCheckbox.props('modelValue')).toBe(true);

		// Click Save button
		const buttons = wrapper.findAllComponents({ name: 'ElButton' });
		const saveBtn = buttons.find((b) => b.text().includes('devicesHomeKitPlugin.wizard.buttons.saveMappings'));
		expect(saveBtn).toBeDefined();

		await saveBtn?.trigger('click');
		await flushPromises();

		expect(mapDevices).toHaveBeenCalledWith(expect.arrayContaining(['d290f1ee-6c54-4b01-90e6-d701748f0851', 'e390f1ee-6c54-4b01-90e6-d701748f0852']));

		// Click header checkbox to deselect all
		await headerCheckbox.vm.$emit('change', false);
		await flushPromises();

		expect(headerCheckbox.props('indeterminate')).toBe(false);
		expect(headerCheckbox.props('modelValue')).toBe(false);
	});

	it('renders pairing step when initialStep is pairing', async () => {
		const wrapper = mountWizard({ initialStep: 'pairing' });
		await flushPromises();

		expect(wrapper.text()).toContain('031-45-154');
		expect(wrapper.find('img[alt="HomeKit QR Code"]').exists()).toBe(true);
		expect(wrapper.text()).toContain('devicesHomeKitPlugin.wizard.pairingDescription');
	});

	it('renders pairing instructions in an ordered list with steps 1 to 3', async () => {
		const wrapper = mountWizard({ initialStep: 'pairing' });
		await flushPromises();

		const ol = wrapper.find('ol');
		expect(ol.exists()).toBe(true);
		expect(ol.classes()).toContain('list-decimal');

		const listItems = ol.findAll('li');
		expect(listItems.length).toBe(3);
		expect(listItems[0].text()).toContain('devicesHomeKitPlugin.wizard.instruction1');
		expect(listItems[1].text()).toContain('devicesHomeKitPlugin.wizard.instruction2');
		expect(listItems[2].text()).toContain('devicesHomeKitPlugin.wizard.instruction3');
	});

	it('renders pairing status alert and refreshes status when refresh button is clicked', async () => {
		const wrapper = mountWizard({ initialStep: 'pairing' });
		await flushPromises();

		expect(wrapper.text()).toContain('devicesHomeKitPlugin.wizard.waitingForPairing');

		const refreshBtn = wrapper
			.findAllComponents({ name: 'ElButton' })
			.find(
				(b) =>
					b.attributes('aria-label') === 'devicesHomeKitPlugin.buttons.refreshStatus' ||
					b.text().includes('devicesHomeKitPlugin.buttons.refreshStatus')
			);
		expect(refreshBtn).toBeDefined();

		await refreshBtn?.trigger('click');
		await flushPromises();

		expect(fetchStatus).toHaveBeenCalled();
	});

	it('preserves mapping selection when candidates succeed while status fails', async () => {
		fetchStatus.mockRejectedValueOnce(new Error('Status network error'));

		const wrapper = mountWizard();
		await flushPromises();

		// Selection was synchronized from candidates despite status failure
		const checkboxes = wrapper.findAllComponents({ name: 'ElCheckbox' });
		expect(checkboxes[1].props('modelValue')).toBe(true);
		expect(checkboxes[2].props('modelValue')).toBe(false);

		// Click Save button
		const buttons = wrapper.findAllComponents({ name: 'ElButton' });
		const saveBtn = buttons.find((b) => b.text().includes('devicesHomeKitPlugin.wizard.buttons.saveMappings'));
		expect(saveBtn?.attributes('disabled')).toBeUndefined();

		await saveBtn?.trigger('click');
		await flushPromises();

		expect(mapDevices).toHaveBeenCalledWith(['d290f1ee-6c54-4b01-90e6-d701748f0851']);
	});

	it('displays error alert and prevents submitting when candidate loading fails', async () => {
		fetchCandidates.mockRejectedValueOnce(new Error('Candidates error'));

		const wrapper = mountWizard();
		await flushPromises();

		expect(wrapper.text()).toContain('devicesHomeKitPlugin.messages.candidatesFetchFailed');

		const buttons = wrapper.findAllComponents({ name: 'ElButton' });
		const saveBtn = buttons.find((b) => b.text().includes('devicesHomeKitPlugin.wizard.buttons.saveMappings'));
		const saveAndPairBtn = buttons.find((b) => b.text().includes('devicesHomeKitPlugin.wizard.buttons.saveAndPair'));

		expect(saveBtn?.attributes('disabled')).toBeDefined();
		expect(saveAndPairBtn?.attributes('disabled')).toBeDefined();

		// Imperative guard check: triggering click should not invoke mapDevices
		await saveBtn?.trigger('click');
		await saveAndPairBtn?.trigger('click');
		await flushPromises();

		expect(mapDevices).not.toHaveBeenCalled();
	});

	it('allows unchecking incompatible mapped devices but prevents selecting new incompatible devices', async () => {
		mockCandidates.value = [
			{
				id: 'dev-1',
				name: 'Compatible Mapped',
				category: 'lighting',
				roomName: 'Living Room',
				roomId: 'room-1',
				isCompatible: true,
				suggestedServiceType: 'lightbulb',
				isMapped: true,
				channelsCount: 1,
			},
			{
				id: 'dev-2',
				name: 'Incompatible Mapped',
				category: 'generic',
				roomName: 'Garage',
				roomId: 'room-2',
				isCompatible: false,
				suggestedServiceType: 'outlet',
				isMapped: true,
				channelsCount: 1,
			},
			{
				id: 'dev-3',
				name: 'Incompatible Unmapped',
				category: 'generic',
				roomName: 'Attic',
				roomId: 'room-3',
				isCompatible: false,
				suggestedServiceType: 'switch',
				isMapped: false,
				channelsCount: 1,
			},
		];

		const wrapper = mountWizard();
		await flushPromises();

		const checkboxes = wrapper.findAllComponents({ name: 'ElCheckbox' });
		// index 0: header, index 1: dev-1, index 2: dev-2, index 3: dev-3
		const dev1Checkbox = checkboxes[1];
		const dev2Checkbox = checkboxes[2];
		const dev3Checkbox = checkboxes[3];

		expect(dev1Checkbox.props('disabled')).toBe(false);
		expect(dev1Checkbox.props('modelValue')).toBe(true);

		// dev-2 is incompatible BUT mapped (selected) -> not disabled
		expect(dev2Checkbox.props('disabled')).toBe(false);
		expect(dev2Checkbox.props('modelValue')).toBe(true);

		// dev-3 is incompatible AND unmapped -> disabled
		expect(dev3Checkbox.props('disabled')).toBe(true);
		expect(dev3Checkbox.props('modelValue')).toBe(false);

		// Uncheck dev-2
		await dev2Checkbox.vm.$emit('update:modelValue', false);
		await flushPromises();

		// Now dev-2 is unmapped and incompatible -> becomes disabled
		expect(dev2Checkbox.props('disabled')).toBe(true);
		expect(dev2Checkbox.props('modelValue')).toBe(false);

		// Attempt to select dev-3 (incompatible) -> guard prevents it
		await dev3Checkbox.vm.$emit('update:modelValue', true);
		await flushPromises();
		expect(dev3Checkbox.props('modelValue')).toBe(false);
	});

	it('blocks all close mechanisms while saving or resetting and emits completed once when idle', async () => {
		savingMappingRef.value = true;

		const wrapper = mountWizard();
		await flushPromises();

		const dialog = wrapper.findComponent({ name: 'ElDialog' });
		expect(dialog.props('showClose')).toBe(false);
		expect(dialog.props('closeOnPressEscape')).toBe(false);

		// before-close hook rejects close when busy
		const doneCallback = vi.fn();
		dialog.props('beforeClose')(doneCallback);
		expect(doneCallback).not.toHaveBeenCalled();

		// close attempt via update:modelValue(false)
		await dialog.vm.$emit('update:modelValue', false);
		await flushPromises();
		expect(wrapper.emitted('update:visible')).toBeUndefined();
		expect(wrapper.emitted('completed')).toBeUndefined();

		// Settle mutation
		savingMappingRef.value = false;
		await flushPromises();

		expect(dialog.props('showClose')).toBe(true);
		expect(dialog.props('closeOnPressEscape')).toBe(true);

		dialog.props('beforeClose')(doneCallback);
		expect(doneCallback).toHaveBeenCalledTimes(1);

		// Trigger dialog update to false (Element Plus standard close flow)
		await dialog.vm.$emit('update:modelValue', false);
		await flushPromises();

		expect(wrapper.emitted('update:visible')).toEqual([[false]]);
		expect(wrapper.emitted('completed')?.length).toBe(1);
	});
});
