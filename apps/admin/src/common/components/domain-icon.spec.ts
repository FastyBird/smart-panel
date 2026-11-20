import { describe, expect, it } from 'vitest';

import { mount } from '@vue/test-utils';

import type { Domain } from './domain-icon.types';
import DomainIcon from './domain-icon.vue';

const DOMAINS: Domain[] = ['lights', 'climate', 'covers', 'media', 'sensors', 'energy', 'cameras'];

describe('DomainIcon.vue', () => {
	it.each(DOMAINS)('tints the %s tile with its domain tokens', (domain) => {
		const wrapper = mount(DomainIcon, { props: { domain } });

		expect(wrapper.attributes('data-domain')).toBe(domain);
		expect(wrapper.classes()).toContain(`text-[var(--fb-domain-${domain})]`);
		expect(wrapper.classes()).toContain(`bg-[var(--fb-domain-${domain}-soft)]`);
	});

	it('is decorative', () => {
		expect(mount(DomainIcon, { props: { domain: 'lights' } }).attributes('aria-hidden')).toBe('true');
	});

	it('sizes the tile, 32 px by default', () => {
		expect(mount(DomainIcon, { props: { domain: 'energy' } }).attributes('style')).toContain('width: 32px');
		expect(mount(DomainIcon, { props: { domain: 'energy', size: 48 } }).attributes('style')).toContain('height: 48px');
	});
});
