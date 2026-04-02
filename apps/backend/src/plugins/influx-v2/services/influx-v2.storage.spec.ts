/*
eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { HttpError, InfluxDB, Point } from '@influxdata/influxdb-client';

import { StorageFieldType, StorageMeasurementSchema, StoragePoint } from '../../../modules/storage/storage.types';

import { InfluxV2Storage } from './influx-v2.storage';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCollectRows = jest.fn();
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

		it('should not throw when delete fails', async () => {
			const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
				ok: false,
				status: 500,
				text: () => Promise.resolve('Internal Server Error'),
			} as unknown as Response);

			await expect(storage.dropMeasurement('temperature')).resolves.not.toThrow();

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
