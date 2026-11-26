import { ElSwitch, ElTooltip } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, mount } from '@vue/test-utils';

import { ExtensionKind } from '../extensions.constants';
import type { IExtension } from '../store/extensions.store.types';

import ExtensionCard from './extension-card.vue';

enableAutoUnmount(afterEach);

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

const extension = (overrides: Partial<IExtension> = {}): IExtension =>
	({
		type: 'devices-shelly-ng-plugin',
		name: 'Shelly NG',
		description: 'Shelly Gen 2 and newer devices',
		kind: ExtensionKind.plugin,
		enabled: true,
		isCore: false,
		canToggleEnabled: true,
		version: '1.2.0',
		author: 'FastyBird',
		links: { documentation: 'https://docs.example.com/shelly', repository: 'https://github.com/example/shelly' },
		...overrides,
	}) as IExtension;

const mountCard = (overrides: Partial<IExtension> = {}) => mount(ExtensionCard, { props: { extension: extension(overrides) } });

describe('ExtensionCard', () => {
	it('names the extension, what it is and whether it is on', () => {
		const wrapper = mountCard();

		expect(wrapper.text()).toContain('Shelly NG');
		expect(wrapper.text()).toContain('extensionsModule.labels.plugin · extensionsModule.labels.addon');
		expect(wrapper.text()).toContain('extensionsModule.labels.enabled');
		expect(wrapper.text()).toContain('1.2.0');
		expect(wrapper.text()).toContain('FastyBird');
	});

	it('links to its documentation and repository in a new tab', () => {
		const wrapper = mountCard();
		const links = wrapper.findAll('a');

		expect(links.map((link) => link.attributes('href'))).toEqual(['https://docs.example.com/shelly', 'https://github.com/example/shelly']);
		expect(links.every((link) => link.attributes('rel') === 'noopener noreferrer' && link.attributes('target') === '_blank')).toBe(true);
	});

	it('switches the extension on and off, and opens its detail', async () => {
		const wrapper = mountCard();

		wrapper.findComponent(ElSwitch).vm.$emit('update:modelValue', false);
		await wrapper.get('[data-test-id="extension-card-detail"]').trigger('click');

		expect(wrapper.emitted('toggle-enabled')).toEqual([['devices-shelly-ng-plugin', false]]);
		expect(wrapper.emitted('detail')).toEqual([['devices-shelly-ng-plugin']]);
	});

	it('keeps the switch off for a core module and says why', () => {
		const wrapper = mountCard({ kind: ExtensionKind.module, isCore: true, canToggleEnabled: false });

		expect(wrapper.findComponent(ElSwitch).props('disabled')).toBe(true);

		const tooltip = wrapper
			.findAllComponents(ElTooltip)
			.find((item) => item.props('content') === 'extensionsModule.tooltips.coreModuleCannotBeDisabled');

		expect(tooltip?.props('disabled')).toBe(false);
	});

	it('says so when there is no description', () => {
		const wrapper = mountCard({ description: undefined });

		expect(wrapper.text()).toContain('extensionsModule.messages.noDescription');
	});
});
