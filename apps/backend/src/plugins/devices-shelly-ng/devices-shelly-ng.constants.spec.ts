import { Em, Em1, Em1Data, EmData, Shelly3EmGen3, ShellyEmGen3, ShellyPro3Em, ShellyProEm } from 'shellies-ds9';

import { devicesSchema } from '../../spec/devices';

import { ComponentType, DESCRIPTORS } from './devices-shelly-ng.constants';

const findDescriptor = (model: string) =>
	Object.values(DESCRIPTORS).find((descriptor) => descriptor.models.includes(model.toUpperCase())) ?? null;

describe('Shelly NG energy meters', () => {
	// A model missing from DESCRIPTORS is rejected outright by
	// DeviceManagerService with "Provided device is not supported", which is what
	// made every EM model unadoptable.
	it.each([
		['SPEM-002CEBEU50', 'Shelly Pro EM'],
		['SPEM-003CEBEU', 'Shelly Pro 3EM'],
		['SPEM-003CEBEU400', 'Shelly Pro 3EM-400'],
		['SPEM-003CEBEU63', 'Shelly Pro 3EM-3CT63'],
		['S3EM-002CXCEU', 'Shelly EM Gen3'],
		['S3EM-003CXCEU63', 'Shelly 3EM-63 G3'],
	])('resolves %s to a descriptor', (model) => {
		expect(findDescriptor(model)).not.toBeNull();
	});

	it('keeps the model strings in step with the library', () => {
		// The descriptors reference the library constants directly, so this only
		// fails if a library upgrade renames a model we hard-coded above.
		expect([
			ShellyProEm.model.toUpperCase(),
			ShellyPro3Em.model.toUpperCase(),
			ShellyEmGen3.model.toUpperCase(),
			Shelly3EmGen3.model.toUpperCase(),
		]).toEqual(['SPEM-002CEBEU50', 'SPEM-003CEBEU', 'S3EM-002CXCEU', 'S3EM-003CXCEU63']);
	});

	it('declares the three-phase and per-phase components for the 3EM models', () => {
		for (const model of ['SPEM-003CEBEU', 'S3EM-003CXCEU63']) {
			const descriptor = findDescriptor(model);

			const byType = new Map(descriptor.components.map((component) => [component.type, component.ids]));

			// Both profiles are declared: the device reports only the set matching
			// the profile it currently runs.
			expect(byType.get(ComponentType.EM)).toEqual([0]);
			expect(byType.get(ComponentType.EM_DATA)).toEqual([0]);
			expect(byType.get(ComponentType.EM1)).toEqual([0, 1, 2]);
			expect(byType.get(ComponentType.EM1_DATA)).toEqual([0, 1, 2]);
		}
	});

	it('declares two meters and a relay for the single-phase models', () => {
		for (const model of ['SPEM-002CEBEU50', 'S3EM-002CXCEU']) {
			const descriptor = findDescriptor(model);

			const byType = new Map(descriptor.components.map((component) => [component.type, component.ids]));

			expect(byType.get(ComponentType.EM1)).toEqual([0, 1]);
			expect(byType.get(ComponentType.EM1_DATA)).toEqual([0, 1]);
			expect(byType.get(ComponentType.SWITCH)).toEqual([0]);
			expect(byType.has(ComponentType.EM)).toBe(false);
		}
	});

	// ComponentType values are compared against the key prefix the device reports,
	// so a value whose casing differs from the library's silently disables the
	// whole component. `devicePower` is exactly that bug, still present.
	it.each([
		[ComponentType.EM, Em],
		[ComponentType.EM_DATA, EmData],
		[ComponentType.EM1, Em1],
		[ComponentType.EM1_DATA, Em1Data],
	])('uses the component key the library reports for %s', (type, cls) => {
		const instance = new (cls as unknown as new (device: unknown, id: number) => { key: string })({}, 0);

		expect(instance.key.split(':')[0]).toBe(String(type));
	});

	it('only assigns categories whose device spec permits the electrical channels', () => {
		const models = [
			'SPEM-002CEBEU50',
			'SPEM-003CEBEU',
			'SPEM-003CEBEU400',
			'SPEM-003CEBEU63',
			'S3EM-002CXCEU',
			'S3EM-003CXCEU63',
		];

		for (const model of models) {
			const descriptor = findDescriptor(model);

			expect(descriptor.categories.length).toBeGreaterThan(0);

			for (const category of descriptor.categories) {
				const channels = (devicesSchema as Record<string, { channels: Record<string, unknown> }>)[category]?.channels;

				// A category that forbids these channels - `generic` does - produces a
				// device that fails spec validation once the meter reports.
				expect(Object.keys(channels ?? {})).toEqual(expect.arrayContaining(['electrical_power', 'electrical_energy']));
			}
		}
	});

	it('defaults the relay models to a category that keeps the relay mappable', () => {
		for (const model of ['SPEM-002CEBEU50', 'S3EM-002CXCEU']) {
			const descriptor = findDescriptor(model);

			// Discovery adopts categories[0]; SENSOR would leave switch:0 unmapped
			// because the sensor spec permits no outlet or switcher channel.
			expect(descriptor.categories[0]).toBe('switcher');
		}
	});
});
