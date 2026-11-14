import { computed, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import SpaceAutomationSpaceField from './space-automation-space-field.vue';

const mocks = vi.hoisted(() => ({ fetchSpaces: vi.fn() }));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

const spaces = ref<{ id: string; name: string; type: string }[]>([]);

vi.mock('../../../../modules/spaces/composables/useSpaces', () => ({
	useSpaces: () => ({
		spaces: computed(() => spaces.value),
		roomSpaces: computed(() => spaces.value.filter((space) => space.type === 'room')),
		zoneSpaces: computed(() => spaces.value.filter((space) => space.type === 'zone')),
		fetching: computed(() => false),
		firstLoadFinished: computed(() => false),
		fetchSpaces: mocks.fetchSpaces,
		findById: (id: string) => spaces.value.find((space) => space.id === id) ?? null,
	}),
}));

describe('SpaceAutomationSpaceField', (): void => {
	it('says when the spaces could not be loaded, and loads them again on retry', async (): Promise<void> => {
		mocks.fetchSpaces.mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(async () => {
			spaces.value = [{ id: 'r-1', name: 'Living room', type: 'room' }];

			return spaces.value;
		});

		const wrapper = mount(SpaceAutomationSpaceField, { props: { modelValue: undefined }, global: { stubs: { Icon: true } } });

		await flushPromises();

		expect(wrapper.find('[data-test-id="spaces-load-failed"]').text()).toContain('spacesHomeControlPlugin.automations.fields.space.loadFailed');
		expect(wrapper.findAllComponents({ name: 'ElOption' })).toHaveLength(0);

		await wrapper.find('[data-test-id="retry-load-spaces"]').trigger('click');
		await flushPromises();

		expect(mocks.fetchSpaces).toHaveBeenCalledTimes(2);
		expect(wrapper.find('[data-test-id="spaces-load-failed"]').exists()).toBe(false);
		expect(wrapper.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value'))).toEqual(['r-1']);

		wrapper.unmount();
	});
});
