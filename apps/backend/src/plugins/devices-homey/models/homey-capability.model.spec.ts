import { HomeyCapabilityType, createHomeyCapability, getHomeyCapabilityBaseId } from './homey-capability.model';

describe('Homey capability model', () => {
	it.each([
		['onoff', 'onoff'],
		['measure_temperature.inside', 'measure_temperature'],
		['measure_temperature.outside', 'measure_temperature'],
		['Vendor_Capability.Instance.Detail', 'Vendor_Capability'],
	])('derives the mapping base ID for %s', (fullId, expectedBaseId) => {
		expect(getHomeyCapabilityBaseId(fullId)).toBe(expectedBaseId);
	});

	it('keeps repeated full IDs distinct while deriving a common enumerable base ID', () => {
		const createTemperature = (id: string, value: number) =>
			createHomeyCapability({
				id,
				title: id,
				value,
				type: HomeyCapabilityType.NUMBER,
				unit: '°C',
				minimum: 0,
				maximum: 50,
				step: 0.1,
				enumValues: [],
				readable: true,
				writable: false,
				available: true,
				lastUpdatedAt: null,
			});

		const capabilities = [
			createTemperature('measure_temperature.inside', 21.5),
			createTemperature('measure_temperature.outside', 9),
		];

		expect(capabilities.map(({ id }) => id)).toStrictEqual([
			'measure_temperature.inside',
			'measure_temperature.outside',
		]);
		expect(capabilities.map(({ baseId }) => baseId)).toStrictEqual(['measure_temperature', 'measure_temperature']);
		expect(Object.keys(capabilities[0])).toContain('baseId');
		expect(capabilities.map(({ value }) => value)).toStrictEqual([21.5, 9]);
	});

	it.each([false, 0, '', null])('preserves the scalar value %p', (value) => {
		const capability = createHomeyCapability({
			id: 'custom.scalar',
			title: 'Scalar',
			value,
			type: HomeyCapabilityType.UNKNOWN,
			unit: null,
			minimum: null,
			maximum: null,
			step: null,
			enumValues: [],
			readable: true,
			writable: true,
			available: null,
			lastUpdatedAt: null,
		});

		expect(capability.value).toBe(value);
	});
});
