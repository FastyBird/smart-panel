import { describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import SpaceDomainCard from './space-domain-card.vue';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../common', () => ({
	DomainIcon: { name: 'DomainIcon', props: ['domain', 'size'], template: '<span />' },
}));

const props = { icon: 'mdi:lightbulb', iconColor: 'warning' as const, title: 'Lighting', description: 'Roles', tags: [], loading: false };

describe('SpaceDomainCard', () => {
	it('shows the shared domain icon for a domain', () => {
		const wrapper = shallowMount(SpaceDomainCard, { props: { ...props, domain: 'lights' as const }, global: { renderStubDefaultSlot: true } });

		expect(wrapper.findComponent({ name: 'DomainIcon' }).props('domain')).toBe('lights');
		expect(wrapper.find('.space-domain-card__icon').exists()).toBe(false);
	});

	it('keeps its own icon without a domain', () => {
		const wrapper = shallowMount(SpaceDomainCard, { props, global: { renderStubDefaultSlot: true } });

		expect(wrapper.findComponent({ name: 'DomainIcon' }).exists()).toBe(false);
		expect(wrapper.find('.space-domain-card__icon').exists()).toBe(true);
	});
});
