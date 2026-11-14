import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { AppBarButtonAlign } from './app-bar-button.types';
import AppBarButton from './app-bar-button.vue';

describe('AppBarButton', (): void => {
	let wrapper: VueWrapper | undefined;
	let target: HTMLElement;

	beforeEach((): void => {
		target = document.createElement('div');
		target.id = 'app-bar-button-small-right';
		document.body.appendChild(target);
	});

	afterEach((): void => {
		wrapper?.unmount();
		target.remove();
	});

	// An icon-only button is named for assistive technology only through what it is given
	it('passes its attributes to the button it renders in the app bar', async (): Promise<void> => {
		wrapper = mount(AppBarButton, {
			props: { align: AppBarButtonAlign.RIGHT, teleport: true, small: true },
			attrs: { 'aria-label': 'From template', 'data-test-id': 'teleported' },
			slots: { icon: '<span />' },
		});

		await flushPromises();

		const button = target.querySelector('button');

		expect(button?.getAttribute('aria-label')).toBe('From template');
		expect(button?.getAttribute('data-test-id')).toBe('teleported');
	});

	it('passes its attributes to the button it renders in place', (): void => {
		wrapper = mount(AppBarButton, {
			props: { align: AppBarButtonAlign.RIGHT },
			attrs: { 'aria-label': 'Close', class: 'mr-2' },
			slots: { icon: '<span />' },
		});

		const button = wrapper.find('button');

		expect(button.attributes('aria-label')).toBe('Close');
		expect(button.classes()).toContain('mr-2');
	});
});
