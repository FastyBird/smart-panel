/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* Reason: The adapter connection and recovery hook are private implementation details exercised through their public API. */
import { InfluxV1Storage } from './influx-v1.storage';

describe('InfluxV1Storage', () => {
	it('propagates database-not-found errors from strict queries while scheduling recovery', async () => {
		const storage = new InfluxV1Storage({ database: 'test' });
		const storageError = new Error('database not found: test');
		const query = jest.fn().mockRejectedValue(storageError);
		(storage as any).connection = { query };
		const setupDatabase = jest.spyOn(storage as any, 'setupDatabase').mockResolvedValue(undefined);

		await expect(storage.queryStrict('SELECT * FROM property_value')).rejects.toBe(storageError);
		expect(setupDatabase).toHaveBeenCalledTimes(1);
	});

	it('forwards the storage abort signal to the Influx v1 request', async () => {
		const storage = new InfluxV1Storage({ database: 'test' });
		const query = jest.fn().mockResolvedValue([]);
		(storage as any).connection = { query };
		const controller = new AbortController();

		await storage.queryStrict('SELECT * FROM property_value', { signal: controller.signal });

		expect(query).toHaveBeenCalledWith(
			'SELECT * FROM property_value',
			expect.objectContaining({ signal: controller.signal }),
		);
	});
});
