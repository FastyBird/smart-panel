import { defineComponent, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IModule } from '../../../common';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import type { IDevicesModuleElementComponents } from '../devices.types';
import type { IDevice } from '../store/devices.store.types';

import { useDeviceCategorySections } from './useDeviceCategorySections';

const mocks = vi.hoisted(() => ({ modules: [] as unknown[] }));

vi.mock('../../../common', () => ({
	injectModulesManager: () => ({ getModules: () => mocks.modules }),
}));

const stub = defineComponent({ template: '<div />' });

const moduleWith = (
	type: string,
	id: string,
	categories: DevicesModuleDeviceCategory[],
	options: { order?: number; modules?: string[] } = {}
): IModule<IDevicesModuleElementComponents> => ({
	type,
	name: type,
	elements: [
		{
			type,
			modules: options.modules ?? [DEVICES_MODULE_NAME],
			components: { deviceCategorySection: { id, categories, component: stub, order: options.order } },
		},
	],
});

const device = (category: DevicesModuleDeviceCategory): IDevice => ({ id: 'd1', category }) as IDevice;

describe('useDeviceCategorySections', () => {
	beforeEach(() => {
		mocks.modules = [];
	});

	it('returns sections registered for the device category', () => {
		mocks.modules = [
			moduleWith('cameras', 'camera', [DevicesModuleDeviceCategory.camera, DevicesModuleDeviceCategory.doorbell]),
			moduleWith('other', 'other', [DevicesModuleDeviceCategory.lighting]),
		];

		const sections = useDeviceCategorySections(ref(device(DevicesModuleDeviceCategory.doorbell)));

		expect(sections.value.map((section) => section.id)).toEqual(['camera']);
	});

	it('ignores elements not targeting the devices module', () => {
		mocks.modules = [moduleWith('cameras', 'camera', [DevicesModuleDeviceCategory.camera], { modules: ['spaces-module'] })];

		const sections = useDeviceCategorySections(() => device(DevicesModuleDeviceCategory.camera));

		expect(sections.value).toEqual([]);
	});

	it('sorts by order', () => {
		mocks.modules = [
			moduleWith('b', 'second', [DevicesModuleDeviceCategory.camera], { order: 5 }),
			moduleWith('a', 'first', [DevicesModuleDeviceCategory.camera], { order: 0 }),
		];

		const sections = useDeviceCategorySections(() => device(DevicesModuleDeviceCategory.camera));

		expect(sections.value.map((section) => section.id)).toEqual(['first', 'second']);
	});

	it('returns nothing while the device is not loaded', () => {
		mocks.modules = [moduleWith('cameras', 'camera', [DevicesModuleDeviceCategory.camera])];

		expect(useDeviceCategorySections(() => null).value).toEqual([]);
	});
});
