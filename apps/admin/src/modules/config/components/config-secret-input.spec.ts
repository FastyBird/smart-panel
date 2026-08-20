import { mount } from '@vue/test-utils';
import { ElButton, ElInput } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import ConfigSecretInput from './config-secret-input.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const factory = (props: Record<string, unknown> = {}) =>
	mount(ConfigSecretInput, {
		props,
		global: {
			components: { ElButton, ElInput },
		},
	});

const emitted = (wrapper: ReturnType<typeof factory>): unknown[][] => (wrapper.emitted('update:modelValue') ?? []) as unknown[][];

describe('ConfigSecretInput', () => {
	it('offers no removal when nothing is stored', () => {
		const wrapper = factory({ configured: false });

		expect(wrapper.findComponent(ElInput).exists()).toBe(true);
		expect(wrapper.findAllComponents(ElButton)).toHaveLength(0);
	});

	it('offers removal once the backend reports a stored value', () => {
		const wrapper = factory({ configured: true });

		expect(wrapper.text()).toContain('configModule.texts.secret.stored');
		expect(wrapper.findComponent(ElButton).text()).toBe('configModule.buttons.removeSecret.title');
	});

	// The whole point of the control: the backend keeps a stored secret for an absent or blank
	// field, so only an explicit `null` asks for it to go.
	it('asks for removal with null', async () => {
		const wrapper = factory({ configured: true });

		await wrapper.findComponent(ElButton).trigger('click');

		expect(emitted(wrapper)).toEqual([[null]]);
	});

	it('reverts a pending removal without submitting anything', async () => {
		const wrapper = factory({ configured: true, modelValue: null });

		expect(wrapper.text()).toContain('configModule.texts.secret.willBeRemoved');
		// The field is out of the way while removal is pending, so nothing can be typed into a
		// value that is on its way out.
		expect(wrapper.findComponent(ElInput).exists()).toBe(false);

		await wrapper.findComponent(ElButton).trigger('click');

		expect(emitted(wrapper)).toEqual([[undefined]]);
	});

	it('submits what is typed', async () => {
		const wrapper = factory({ configured: true });

		await wrapper.findComponent(ElInput).setValue('a new secret');

		expect(emitted(wrapper)).toEqual([['a new secret']]);
	});

	// Typing and then clearing again leaves the field exactly as it was found, and an untouched
	// field must not be submitted at all - blanking one is not a way to remove a credential.
	it('submits nothing for a field cleared back to blank', async () => {
		const wrapper = factory({ configured: true, modelValue: 'half typed' });

		await wrapper.findComponent(ElInput).setValue('');

		expect(emitted(wrapper)).toEqual([[undefined]]);
	});

	it('renders the multi-line credentials as a textarea', () => {
		const wrapper = factory({ type: 'textarea', rows: 4 });

		expect(wrapper.findComponent(ElInput).props('type')).toBe('textarea');
		expect(wrapper.findComponent(ElInput).props('rows')).toBe(4);
	});
});
