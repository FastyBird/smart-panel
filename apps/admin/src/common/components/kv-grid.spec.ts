import { createI18n } from 'vue-i18n';

import { describe, expect, it } from 'vitest';

import { mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';

import type { KvGridProps } from './kv-grid.types';
import KvGrid from './kv-grid.vue';

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });

const render = (props: KvGridProps) => mount(KvGrid, { props, global: { plugins: [i18n] } });

describe('KvGrid.vue', () => {
	it('renders a term and a description for each item', () => {
		const wrapper = render({
			items: [
				{ label: 'Model', value: 'Shelly Plus 1' },
				{ label: 'Firmware', value: '1.4.2' },
			],
		});

		expect(wrapper.findAll('dt').map((node) => node.text())).toEqual(['Model', 'Firmware']);
		expect(wrapper.findAll('dd').map((node) => node.text())).toEqual(['Shelly Plus 1', '1.4.2']);
	});

	it('shows N/A for empty values but keeps zero', () => {
		const wrapper = render({
			items: [
				{ label: 'IP', value: null },
				{ label: 'Name', value: '' },
				{ label: 'Retries', value: 0 },
			],
		});

		expect(wrapper.findAll('dd').map((node) => node.text())).toEqual(['N/A', 'N/A', '0']);
		expect(wrapper.find('dd span').classes()).toContain('text-muted');
	});

	it('uses the mono style for mono items', () => {
		const wrapper = render({ items: [{ label: 'ID', value: 'abc-123', mono: true }] });

		expect(wrapper.find('dd').classes()).toContain('text-mono');
	});

	it('links values with an href, opening external links in a new tab', () => {
		const wrapper = render({
			items: [
				{ label: 'Docs', value: 'Guide', href: 'https://example.com/guide' },
				{ label: 'Device', value: 'Kitchen', href: '/devices/1' },
			],
		});

		const [external, internal] = wrapper.findAll('a');

		expect(external.attributes('href')).toBe('https://example.com/guide');
		expect(external.attributes('target')).toBe('_blank');
		expect(external.attributes('rel')).toBe('noopener noreferrer');
		expect(internal.attributes('target')).toBeUndefined();
	});

	it.each([
		[2, 'tp:grid-cols-2'],
		[3, 'tl:grid-cols-3'],
		[4, 'tl:grid-cols-4'],
	] as const)('lays out %i columns from tablet size, one on phones', (cols, cls) => {
		const wrapper = render({ items: [], cols });

		expect(wrapper.classes()).toContain('grid-cols-1');
		expect(wrapper.classes()).toContain(cls);
	});
});
