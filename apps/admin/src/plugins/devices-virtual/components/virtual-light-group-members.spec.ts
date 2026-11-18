import { defineComponent, h, nextTick, ref } from 'vue';

import { ElOption, ElOptionGroup, ElSelect } from 'element-plus';
import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { provideVirtualWizardPlacement } from '../composables/use-virtual-wizard-placement';

import VirtualLightGroupMembers from './virtual-light-group-members.vue';

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

describe('shared placement preference in nested member pickers', () => {
	it('reacts to room and zone changes while preserving selected and ineligible members', async () => {
		const placement = ref({ roomId: 'bedroom', zoneIds: ['downstairs'] });
		const candidates = [
			{ id: 'other', label: 'Other', roomId: 'hall', zoneIds: [], eligible: false },
			{ id: 'zone', label: 'Zone', roomId: 'kitchen', zoneIds: ['downstairs'], eligible: true },
			{ id: 'room', label: 'Room', roomId: 'bedroom', zoneIds: ['downstairs'], eligible: true },
		];
		const view = mount(
			defineComponent({
				setup() {
					provideVirtualWizardPlacement(placement);
					return () => h(VirtualLightGroupMembers, { modelValue: ['other'], candidates });
				},
			})
		);
		await flushPromises();
		const labels = () => view.findAllComponents(ElOptionGroup).map((group) => group.props('label'));
		expect(labels()).toEqual([
			'devicesVirtualPlugin.wizard.layout.roomSources',
			'devicesVirtualPlugin.wizard.layout.zoneSources',
			'devicesVirtualPlugin.wizard.layout.otherSources',
		]);
		expect(view.findAllComponents(ElOption).map((option) => option.props('value'))).toEqual(['room', 'zone', 'other']);
		// A selected ineligible member remains visible and removable, as in the existing repair flow.
		expect(
			view
				.findAllComponents(ElOption)
				.find((option) => option.props('value') === 'other')
				?.props('disabled')
		).toBe(false);
		placement.value = { roomId: 'kitchen', zoneIds: [] };
		await nextTick();
		expect(labels()).toEqual(['devicesVirtualPlugin.wizard.layout.roomSources', 'devicesVirtualPlugin.wizard.layout.otherSources']);
		expect(view.getComponent(ElSelect).props('modelValue')).toEqual(['other']);
		expect(view.getComponent(VirtualLightGroupMembers).emitted('update:modelValue')).toBeUndefined();
		view.unmount();
	});
});
