import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { DevicesModuleDeviceHiddenBy } from '../../../../openapi.constants';
import type { IDevice } from '../../store/devices.store.types';

import DevicesTableColumnHidden from './devices-table-column-hidden.vue';

const edit = vi.fn();

const flashMessage = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../common', async () => {
	const actual = await vi.importActual('../../../../common');

	return {
		...actual,
		injectStoresManager: () => ({ getStore: () => ({ edit }) }),
		useFlashMessage: () => flashMessage,
		useLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
	};
});

const device = (overrides: Partial<IDevice> = {}): IDevice =>
	({ id: 'device-1', type: 'shelly-ng', name: 'Relay board', hidden: true, hiddenBy: DevicesModuleDeviceHiddenBy.user, ...overrides }) as IDevice;

describe('DevicesTableColumnHidden', () => {
	it('renders nothing for a visible device', () => {
		const wrapper = mount(DevicesTableColumnHidden, { props: { device: device({ hidden: false }) } });

		expect(wrapper.find('[data-test-id="unhide-device"]').exists()).toBe(false);
	});

	// A system hide reverses itself when the last virtual device referencing the source goes, but a user
	// hide has no such trigger — and the wizard's own hint tells the operator this list can undo it.
	it('offers an unhide action on a hidden device', () => {
		const wrapper = mount(DevicesTableColumnHidden, { props: { device: device() } });

		expect(wrapper.find('[data-test-id="unhide-device"]').exists()).toBe(true);
	});

	// Only `hidden` goes on the wire: no client can send `hidden_by: null`, so the backend clears the
	// provenance itself once the device is visible again.
	it('sends only the hidden flag, leaving provenance to the backend', async () => {
		edit.mockResolvedValueOnce(undefined);

		const wrapper = mount(DevicesTableColumnHidden, { props: { device: device() } });

		await wrapper.get('[data-test-id="unhide-device"]').trigger('click');

		expect(edit).toHaveBeenCalledWith({ id: 'device-1', data: { type: 'shelly-ng', hidden: false } });
	});

	it('reports a failure instead of silently leaving the device hidden', async () => {
		edit.mockRejectedValueOnce(new Error('refused'));

		const wrapper = mount(DevicesTableColumnHidden, { props: { device: device() } });

		await wrapper.get('[data-test-id="unhide-device"]').trigger('click');
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(flashMessage.error).toHaveBeenCalled();
	});
});
