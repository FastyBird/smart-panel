import { DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';

import { HomeyPropertyMappingBinding, ResolvedHomeyPropertyMapping } from './mapping.types';
import { HomeyPropertyMappingStorageService } from './property-mapping-storage.service';

const mapping: ResolvedHomeyPropertyMapping = {
	kind: 'properties',
	source: 'builtin',
	name: 'measured-temperature',
	priority: 100,
	exclusive: false,
	conflict: 'error',
	match: {
		classes: ['sensor'],
		capabilityBaseIds: ['measure_temperature'],
		allCapabilities: [],
		noneCapabilities: [],
		driverIds: [],
		manufacturers: [],
		models: [],
	},
	property: {
		channel: 'temperature',
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		direction: 'read_only',
	},
};

const binding = (capabilityId: string): HomeyPropertyMappingBinding => ({
	homeyDeviceId: 'device-1',
	capabilityId,
	mapping,
});

describe('HomeyPropertyMappingStorageService', () => {
	it('stores, replaces, removes, and clears property bindings', () => {
		const service = new HomeyPropertyMappingStorageService();
		service.store('property-1', binding('measure_temperature.inside'));
		service.store('property-1', binding('measure_temperature.outside'));

		expect(service.size).toBe(1);
		expect(service.get('property-1')?.capabilityId).toBe('measure_temperature.outside');

		service.remove('property-1');
		expect(service.get('property-1')).toBeUndefined();

		service.store('property-2', binding('measure_temperature.inside'));
		service.clear();
		expect(service.size).toBe(0);
	});

	it('finds bindings only by exact device and full capability ID', () => {
		const service = new HomeyPropertyMappingStorageService();
		service.store('inside', binding('measure_temperature.inside'));
		service.store('outside', binding('measure_temperature.outside'));

		expect(service.findByCapability('device-1', 'measure_temperature.inside')).toEqual([
			binding('measure_temperature.inside'),
		]);
		expect(service.findByCapability('device-1', 'measure_temperature')).toEqual([]);
		expect(service.findByCapability('device-2', 'measure_temperature.inside')).toEqual([]);
	});
});
