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
			fetchingCandidates: ref(false),
			fetchingStatus: ref(false),
			savingMapping: ref(false),
			resettingPairing: ref(false),
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
					props: ['width', 'modelValue'],
					template: '<div class="el-dialog"><slot /></div>',
				},
				Icon: true,
			},
		},
	});
};

describe('HomeKitSetupWizard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
});
