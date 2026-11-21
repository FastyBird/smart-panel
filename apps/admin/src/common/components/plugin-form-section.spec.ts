/* eslint-disable vue/one-component-per-file -- parent components that hold the sections */
import { defineComponent, ref } from 'vue';

import { describe, expect, it } from 'vitest';

import { mount } from '@vue/test-utils';

import type { PluginFormSectionProps } from './plugin-form-section.types';
import PluginFormSection from './plugin-form-section.vue';

const render = (props: PluginFormSectionProps) =>
	mount(PluginFormSection, { props, slots: { default: '<input data-test-id="field" />' }, attachTo: document.body });

const body = (wrapper: ReturnType<typeof render>) => wrapper.find('[data-test-id="plugin-form-section-body"]');

describe('PluginFormSection.vue', () => {
	it('renders the title as the heading that names the section, with its description', () => {
		const wrapper = render({ title: 'Connection', description: 'Where measurements are written.' });

		const heading = wrapper.find('h3');

		expect(heading.text()).toBe('Connection');
		expect(wrapper.attributes('aria-labelledby')).toBe(heading.attributes('id'));
		expect(wrapper.text()).toContain('Where measurements are written.');
		expect((body(wrapper).element as HTMLElement).style.display).toBe('');

		wrapper.unmount();
	});

	it('starts an advanced section collapsed and opens it from its heading', async () => {
		const wrapper = render({ title: 'Advanced', advanced: true });

		const toggle = wrapper.find('[data-test-id="plugin-form-section-toggle"]');

		expect(toggle.element.tagName).toBe('BUTTON');
		expect(toggle.attributes('aria-expanded')).toBe('false');
		expect(toggle.attributes('aria-controls')).toBe(body(wrapper).attributes('id'));
		expect((body(wrapper).element as HTMLElement).style.display).toBe('none');

		await toggle.trigger('click');

		expect(toggle.attributes('aria-expanded')).toBe('true');
		expect((body(wrapper).element as HTMLElement).style.display).toBe('');
		expect(wrapper.emitted('update:expanded')).toEqual([[true]]);

		wrapper.unmount();
	});

	it('keeps the fields of a collapsed section mounted, so the form still validates them', () => {
		const wrapper = render({ title: 'Advanced', advanced: true });

		expect(wrapper.find('[data-test-id="field"]').exists()).toBe(true);

		wrapper.unmount();
	});

	it('follows an open state the parent owns', async () => {
		const wrapper = render({ title: 'Advanced', advanced: true, expanded: true });

		expect(wrapper.find('[data-test-id="plugin-form-section-toggle"]').attributes('aria-expanded')).toBe('true');

		await wrapper.setProps({ expanded: false });

		expect(wrapper.find('[data-test-id="plugin-form-section-toggle"]').attributes('aria-expanded')).toBe('false');

		wrapper.unmount();
	});

	it('leaves a supplied open state to the parent, only asking it to change', async () => {
		const wrapper = render({ title: 'Advanced', advanced: true, expanded: false });

		const toggle = wrapper.find('[data-test-id="plugin-form-section-toggle"]');

		await toggle.trigger('click');

		expect(wrapper.emitted('update:expanded')).toEqual([[true]]);
		expect(toggle.attributes('aria-expanded')).toBe('false');
		expect((body(wrapper).element as HTMLElement).style.display).toBe('none');

		wrapper.unmount();
	});

	it('opens and closes through v-model:expanded', async () => {
		const open = ref(false);
		const wrapper = mount(
			defineComponent({
				components: { PluginFormSection },
				setup: () => ({ open }),
				template: '<plugin-form-section v-model:expanded="open" title="Advanced" advanced />',
			})
		);

		await wrapper.find('[data-test-id="plugin-form-section-toggle"]').trigger('click');

		expect(open.value).toBe(true);
		expect(wrapper.find('[data-test-id="plugin-form-section-toggle"]').attributes('aria-expanded')).toBe('true');

		await wrapper.find('[data-test-id="plugin-form-section-toggle"]').trigger('click');

		expect(open.value).toBe(false);
	});

	it('gives every section its own heading id', () => {
		const wrapper = mount(
			defineComponent({
				components: { PluginFormSection },
				setup: () => ({ open: ref(false) }),
				template: '<form><plugin-form-section title="Connection" /><plugin-form-section v-model:expanded="open" title="Advanced" advanced /></form>',
			})
		);

		const sections = wrapper.findAll('[data-test-id="plugin-form-section"]');
		const ids = sections.map((section) => section.attributes('aria-labelledby'));

		expect(new Set(ids).size).toBe(2);
		expect(sections.map((section) => section.find(`#${ids[sections.indexOf(section)]}`).exists())).toEqual([true, true]);
	});
});
