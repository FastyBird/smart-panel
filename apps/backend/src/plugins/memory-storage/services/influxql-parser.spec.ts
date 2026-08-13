import { InMemoryTimeSeriesStore } from './in-memory-timeseries.store';
import { InfluxQLParser } from './influxql-parser';

describe('InfluxQLParser', () => {
	let store: InMemoryTimeSeriesStore;
	let parser: InfluxQLParser;

	beforeEach(() => {
		store = new InMemoryTimeSeriesStore();
		parser = new InfluxQLParser(store);
	});

	afterEach(() => store.destroy());

	it('applies a raw LIMIT independently to every tag group', () => {
		store.writePoints([
			{
				measurement: 'property_value',
				tags: { propertyId: 'property-a' },
				fields: { numberValue: 1 },
				timestamp: new Date('2026-08-06T12:00:00Z'),
			},
			{
				measurement: 'property_value',
				tags: { propertyId: 'property-a' },
				fields: { numberValue: 2 },
				timestamp: new Date('2026-08-06T12:01:00Z'),
			},
			{
				measurement: 'property_value',
				tags: { propertyId: 'property-b' },
				fields: { numberValue: 3 },
				timestamp: new Date('2026-08-06T12:02:00Z'),
			},
		]);

		const rows = parser.execute<{ propertyId: string; numberValue: number }>(`
			SELECT * FROM property_value
			WHERE (propertyId = 'property-a' OR propertyId = 'property-b')
			GROUP BY "propertyId"
			ORDER BY time DESC
			LIMIT 1
		`);

		expect(rows).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ propertyId: 'property-a', numberValue: 2 }),
				expect.objectContaining({ propertyId: 'property-b', numberValue: 3 }),
			]),
		);
		expect(rows).toHaveLength(2);
	});

	it('deletes only matching measurements inside the requested time range', () => {
		store.writePoints([
			{
				measurement: 'property_value',
				tags: { propertyId: 'property-a' },
				fields: { numberValue: 1 },
				timestamp: new Date('2026-08-12T20:00:00.000Z'),
			},
			{
				measurement: 'property_value',
				tags: { propertyId: 'property-a' },
				fields: { numberValue: 2 },
				timestamp: new Date('2026-08-12T20:00:00.001Z'),
			},
			{
				measurement: 'property_value',
				tags: { propertyId: 'property-b' },
				fields: { numberValue: 3 },
				timestamp: new Date('2026-08-12T20:00:00.002Z'),
			},
		]);

		parser.execute("DELETE FROM property_value WHERE propertyId = 'property-a' AND time >= '2026-08-12T20:00:00.001Z'");

		expect(parser.execute<{ propertyId: string; numberValue: number }>('SELECT * FROM property_value')).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ propertyId: 'property-a', numberValue: 1 }),
				expect.objectContaining({ propertyId: 'property-b', numberValue: 3 }),
			]),
		);
		expect(parser.execute('SELECT * FROM property_value')).toHaveLength(2);
	});
});
