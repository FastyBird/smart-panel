import { reactive, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { FormResult } from '../../config';
import type { INotificationsConfigEditForm } from '../schemas/config.schemas';

import NotificationsConfigForm from './notifications-config-form.vue';

const useConfigModuleEditFormMock = vi.fn();

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../config', async () => {
	const actual = await vi.importActual('../../config');

	return {
		...actual,
		useConfigModuleEditForm: () => useConfigModuleEditFormMock(),
	};
});

describe('NotificationsConfigForm', () => {
	beforeEach(() => {
		const model = reactive({
			type: 'notifications-module',
			enabled: true,
			retentionDays: 30,
			maxNotifications: 500,
		}) as unknown as INotificationsConfigEditForm;

		useConfigModuleEditFormMock.mockReset().mockReturnValue({
			formEl: ref(undefined),
			model,
			formChanged: ref(false),
			submit: vi.fn().mockResolvedValue('saved'),
			formResult: ref(FormResult.NONE),
		});
	});

	// `el-form-item` silently drops an `#append` slot (it only ever renders its own label/default/
	// error slots) - the unit text has to live inside `el-input-number`'s own `#suffix` slot to be
	// visible at all.
	it('renders the retention period unit next to the input, not lost in an unsupported form-item slot', () => {
		const wrapper = mount(NotificationsConfigForm, {
			props: { config: { type: 'notifications-module', enabled: true } },
		});

		expect(wrapper.text()).toContain('notificationsModule.fields.config.retentionDays.unit');
	});

	it('renders a unit next to the max notifications input', () => {
		const wrapper = mount(NotificationsConfigForm, {
			props: { config: { type: 'notifications-module', enabled: true } },
		});

		expect(wrapper.text()).toContain('notificationsModule.fields.config.maxNotifications.unit');
	});
});
