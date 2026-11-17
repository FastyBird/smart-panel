import { afterEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { DevicesModuleDeviceCategory } from '../../../../openapi.constants';
import VirtualPlacementFields from '../virtual-placement-fields.vue';

import Details from './virtual-wizard-details-step.vue';

enableAutoUnmount(afterEach);
const fetch = vi.hoisted(() => vi.fn(async () => []));
vi.mock('../../../../common', () => ({ injectStoresManager: () => ({ getStore: () => ({ fetch, findAll: () => [] }) }) }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
const props = { category: DevicesModuleDeviceCategory.lighting, name: '', roomId: null, zoneIds: [] };

describe('projection device details', () => {
	it('keeps the name manual across category, room and zone changes and remounts', async () => {
		const view = mount(Details, { props });
		await flushPromises();
		expect(view.emitted('update:name')).toBeUndefined();
		await view.setProps({ category: DevicesModuleDeviceCategory.switcher, roomId: 'living', zoneIds: ['downstairs'] });
		expect(view.emitted('update:name')).toBeUndefined();
		await view.get('input[name="name"]').setValue('Custom relay');
		expect(view.emitted('update:name')).toEqual([['Custom relay']]);
		await view.setProps({ name: 'Custom relay', roomId: 'bedroom' });
		expect(view.get<HTMLInputElement>('input[name="name"]').element.value).toBe('Custom relay');
	});
	it('places category between name and the common placement fields and forwards placement changes', () => {
		const view = mount(Details, { props, slots: { category: '<div data-category-picker>Category</div>' } });
		const fields = view.findAll(
			'input[name="name"], [data-category-picker], [data-test-id="virtual-placement-room"], [data-test-id="virtual-placement-zones"]'
		);
		expect(fields[0].attributes('name')).toBe('name');
		expect(fields[1].attributes('data-category-picker')).toBeDefined();
		const placement = view.getComponent(VirtualPlacementFields);
		placement.vm.$emit('update:roomId', 'living');
		placement.vm.$emit('update:zoneIds', ['downstairs']);
		expect(view.emitted('update:roomId')).toEqual([['living']]);
		expect(view.emitted('update:zoneIds')).toEqual([[['downstairs']]]);
	});
});
