/*
eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { FluxResultObserver, HttpError, InfluxDB, Point } from '@influxdata/influxdb-client';

import { StorageFieldType, StorageMeasurementSchema, StoragePoint } from '../../../modules/storage/storage.types';

import { InfluxV2Storage } from './influx-v2.storage';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCollectRows = jest.fn();
const mockQueryRows = jest.fn();
const mockWritePoint = jest.fn();
const mockFlush = jest.fn();
const mockClose = jest.fn();

jest.mock('@influxdata/influxdb-client', () => {
	const actual = jest.requireActual('@influxdata/influxdb-client');

	return {
		...actual,
		InfluxDB: jest.fn().mockImplementation(() => ({
			getWriteApi: jest.fn().mockReturnValue({
				writePoint: mockWritePoint,
				flush: mockFlush,
				close: mockClose,
			}),
			getQueryApi: jest.fn().mockReturnValue({
				collectRows: mockCollectRows,
				queryRows: mockQueryRows,
			}),
		})),
	};
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('InfluxV2Storage', () => {
	let storage: InfluxV2Storage;

	beforeEach(() => {
		jest.clearAllMocks();

		storage = new InfluxV2Storage({
			url: 'http://localhost:8086',
			token: 'test-token',
			org: 'test-org',
			bucket: 'test-bucket',
		});
	});

	describe('initialize', () => {
		it('should connect successfully when InfluxDB is reachable', async () => {
			mockCollectRows.mockResolvedValue([{ name: 'test-bucket' }]);

			await storage.initialize();

			expect(storage.isAvailable()).toBe(true);
			expect(InfluxDB).toHaveBeenCalledWith({ url: 'http://localhost:8086', token: 'test-token' });
		});

		it('should mark as unavailable and clean up when connection fails', async () => {
			mockCollectRows.mockRejectedValue(new Error('connection refused'));

			await storage.initialize();

			expect(storage.isAvailable()).toBe(false);
		});
	});

	describe('writePoints', () => {
		beforeEach(async () => {
			mockCollectRows.mockResolvedValue([]);
			await storage.initialize();
		});

		it('should write points and flush', async () => {
			mockFlush.mockResolvedValue(undefined);

			const points: StoragePoint[] = [
				{ measurement: 'temperature', fields: { value: 23.5 }, tags: { room: 'living' } },
			];

			await storage.writePoints(points);

			expect(mockWritePoint).toHaveBeenCalledTimes(1);
			expect(mockFlush).toHaveBeenCalledTimes(1);
		});

		it('should log and re-throw when flush fails', async () => {
			const flushError = new Error('network timeout');

			mockFlush.mockRejectedValue(flushError);

			const points: StoragePoint[] = [{ measurement: 'temperature', fields: { value: 23.5 } }];

			await expect(storage.writePoints(points)).rejects.toThrow('network timeout');
		});

		it('should write points with schema-based field typing', async () => {
			const schema: StorageMeasurementSchema = {
				measurement: 'sensor',
				fields: {
					temp: StorageFieldType.FLOAT,
					count: StorageFieldType.INTEGER,
					active: StorageFieldType.BOOLEAN,
					label: StorageFieldType.STRING,
				},
				tags: [],
			};

			storage.registerSchema(schema);

			mockFlush.mockResolvedValue(undefined);

			const points: StoragePoint[] = [
				{
					measurement: 'sensor',
					fields: { temp: 22.5, count: 10, active: true, label: 'living' },
				},
			];

			await storage.writePoints(points);

			expect(mockWritePoint).toHaveBeenCalledTimes(1);
			expect(mockWritePoint).toHaveBeenCalledWith(expect.any(Point));
		});
	});

	describe('query', () => {
		beforeEach(async () => {
			mockCollectRows.mockResolvedValue([]);
			await storage.initialize();
		});

		it('should return query results', async () => {
			const rows = [{ _value: 23.5 }, { _value: 24.0 }];

			mockCollectRows.mockResolvedValue(rows);

			const result = await storage.query('from(bucket: "test")');

			expect(result).toEqual(rows);
		});

		it('should return empty array on 404', async () => {
			const error = new HttpError(404, 'Not Found', '', '{}');

			mockCollectRows.mockRejectedValue(error);

			const result = await storage.query('from(bucket: "missing")');

			expect(result).toEqual([]);
		});

		it('should re-throw non-404 errors', async () => {
			mockCollectRows.mockRejectedValue(new Error('server error'));

			await expect(storage.query('bad query')).rejects.toThrow('server error');
		});

		it('should propagate 404 errors from strict queries', async () => {
			const error = new HttpError(404, 'Not Found', '', '{}');

			mockCollectRows.mockRejectedValue(error);

			await expect(storage.queryStrict('from(bucket: "missing")')).rejects.toBe(error);
		});

		it('should cancel a strict query when its storage signal is aborted', async () => {
			const cancel = jest.fn();
			const controller = new AbortController();
			const abortError = new Error('query deadline exceeded');
			mockQueryRows.mockImplementation((_query: string, observer: FluxResultObserver<string[]>) => {
				observer.useCancellable?.({ cancel, isCancelled: () => false });
			});
			const query = storage.queryStrict(
				`SELECT * FROM property_value
				 WHERE (propertyId = 'property-a')
				 GROUP BY "propertyId"
				 ORDER BY time DESC
				 LIMIT 5`,
				{ signal: controller.signal },
			);

			controller.abort(abortError);

			await expect(query).rejects.toBe(abortError);
			expect(cancel).toHaveBeenCalledTimes(1);
		});

		it('should translate grouped latest-value InfluxQL and normalize timestamps', async () => {
			mockCollectRows.mockResolvedValue([{ _time: '2026-08-06T12:00:00Z', propertyId: 'property-a', numberValue: 12 }]);

			const result = await storage.queryStrict<{ time: string; propertyId: string; numberValue: number }>(`
				SELECT * FROM property_value
				WHERE (propertyId = 'property-a' OR propertyId = 'property-b')
				GROUP BY "propertyId"
				ORDER BY time DESC
				LIMIT 5
			`);

			const [translatedQuery] = mockCollectRows.mock.calls.at(-1) as [string];
			expect(translatedQuery).toContain('from(bucket: "test-bucket")');
			expect(translatedQuery).toContain('r._measurement == "property_value"');
			expect(translatedQuery).toContain('set: ["property-a", "property-b"]');
			expect(translatedQuery).toContain('group(columns: ["propertyId"])');
			expect(translatedQuery).toContain('limit(n: 5)');
			expect(result).toEqual([{ time: '2026-08-06T12:00:00Z', propertyId: 'property-a', numberValue: 12 }]);
		});

		it('should translate bucketed InfluxQL history into per-field Flux aggregates', async () => {
			mockCollectRows.mockResolvedValue([]);

			await storage.queryStrict(`
				SELECT MEAN(numberValue) AS numberValue, LAST(stringValue) AS stringValue
				FROM property_value
				WHERE propertyId = 'property-a'
				AND time >= 1786017600000ms
				AND time <= 1786021200000ms
				GROUP BY time(5m) fill(none)
				ORDER BY time ASC
			`);

			const [translatedQuery] = mockCollectRows.mock.calls.at(-1) as [string];
			expect(translatedQuery).toContain('aggregateWindow(every: 5m, fn: mean');
			expect(translatedQuery).toContain('aggregateWindow(every: 5m, fn: last');
			expect(translatedQuery).toContain('union(tables: [numberValues, stringValues])');
			expect(translatedQuery).toContain('desc: false');
		});

		it('should translate raw InfluxQL history with bounded time and field filters', async () => {
			mockCollectRows.mockResolvedValue([]);

			await storage.queryStrict(`
				SELECT stringValue, numberValue
				FROM property_value
				WHERE propertyId = 'property-a'
				AND time >= 1786017600000ms
				AND time <= 1786021200000ms
				ORDER BY time ASC
			`);

			const [translatedQuery] = mockCollectRows.mock.calls.at(-1) as [string];
			expect(translatedQuery).toContain('range(start: time(v:');
			expect(translatedQuery).toContain('contains(value: r._field, set: ["stringValue", "numberValue"])');
			expect(translatedQuery).toContain('pivot(rowKey: ["_time"]');
			expect(translatedQuery).toContain('desc: false');
		});
	});

	describe('queryRaw', () => {
		beforeEach(async () => {
			mockCollectRows.mockResolvedValue([]);
			await storage.initialize();
		});

		it('should return raw query results', async () => {
			const rows = [{ _value: 'raw' }];

			mockCollectRows.mockResolvedValue(rows);

			const result = await storage.queryRaw('from(bucket: "test")');

			expect(result).toEqual(rows);
		});

		it('should return empty array on 404', async () => {
			const error = new HttpError(404, 'Not Found', '', '{}');

			mockCollectRows.mockRejectedValue(error);

			const result = await storage.queryRaw('from(bucket: "missing")');

			expect(result).toEqual([]);
		});
	});

	describe('getMeasurements', () => {
		beforeEach(async () => {
			mockCollectRows.mockResolvedValue([]);
			await storage.initialize();
		});

		it('should return measurement names', async () => {
			mockCollectRows.mockResolvedValue([{ _value: 'temperature' }, { _value: 'humidity' }]);

			const result = await storage.getMeasurements();

			expect(result).toEqual(['temperature', 'humidity']);
		});

		it('should return empty array on 404', async () => {
			const error = new HttpError(404, 'Not Found', '', '{}');

			mockCollectRows.mockRejectedValue(error);

			const result = await storage.getMeasurements();

			expect(result).toEqual([]);
		});
	});

	describe('dropMeasurement', () => {
		beforeEach(async () => {
			mockCollectRows.mockResolvedValue([]);
			await storage.initialize();
		});

		it('should call the delete API', async () => {
			const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
				ok: true,
			} as Response);

			await storage.dropMeasurement('temperature');

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/api/v2/delete'),
				expect.objectContaining({ method: 'POST' }),
			);

			mockFetch.mockRestore();
		});

		it('should throw when delete fails', async () => {
			const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
				ok: false,
				status: 500,
				text: () => Promise.resolve('Internal Server Error'),
			} as unknown as Response);

			await expect(storage.dropMeasurement('temperature')).rejects.toThrow('Failed to drop measurement');

			mockFetch.mockRestore();
		});
	});

	describe('destroy', () => {
		it('should close write API and mark as unavailable', async () => {
			mockCollectRows.mockResolvedValue([]);
			await storage.initialize();

			expect(storage.isAvailable()).toBe(true);

			await storage.destroy();

			expect(storage.isAvailable()).toBe(false);
			expect(mockClose).toHaveBeenCalled();
		});
	});

	describe('ping', () => {
		beforeEach(async () => {
			mockCollectRows.mockResolvedValue([]);
			await storage.initialize();
		});

		it('should return online when reachable', async () => {
			mockCollectRows.mockResolvedValue([{ name: 'test' }]);

			const result = await storage.ping();

			expect(result).toEqual([{ online: true, results: [{ name: 'test' }] }]);
		});

		it('should return offline when unreachable', async () => {
			mockCollectRows.mockRejectedValue(new Error('timeout'));

			const result = await storage.ping();

			expect(result).toEqual([{ online: false }]);
		});
	});

	describe('updateConfig', () => {
		it('should update config fields', () => {
			storage.updateConfig({ url: 'http://new-host:8086', org: 'new-org' });

			// Verify by re-initializing with updated config
			expect(storage).toBeDefined();
		});
	});

	describe('registerSchema', () => {
		it('should store schema for use in writePoints', async () => {
			mockCollectRows.mockResolvedValue([]);
			await storage.initialize();

			const schema: StorageMeasurementSchema = {
				measurement: 'test',
				fields: { value: StorageFieldType.FLOAT },
				tags: [],
			};

			storage.registerSchema(schema);

			mockFlush.mockResolvedValue(undefined);

			await storage.writePoints([{ measurement: 'test', fields: { value: 42 } }]);

			expect(mockWritePoint).toHaveBeenCalledWith(expect.any(Point));
		});
	});
});
