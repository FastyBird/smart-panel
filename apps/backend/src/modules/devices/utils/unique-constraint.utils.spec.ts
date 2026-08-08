import { QueryFailedError } from 'typeorm';

import { isPrimaryKeyCollision } from './unique-constraint.utils';

describe('isPrimaryKeyCollision', () => {
	// What TypeORM actually hands the service: the driver's text lives on `driverError`, and the
	// wrapper repeats it in its own message.
	const queryFailed = (message: string): QueryFailedError =>
		Object.assign(new QueryFailedError('INSERT INTO ...', [], new Error(message)), {
			driverError: { message },
		});

	it('recognises a primary key rejected by name', () => {
		expect(isPrimaryKeyCollision(queryFailed('UNIQUE constraint failed: devices_module_devices.id'))).toBe(true);
	});

	// The phrasing SQLite uses for a rowid alias rather than a named column.
	it('recognises the rowid phrasing', () => {
		expect(isPrimaryKeyCollision(queryFailed('SQLITE_CONSTRAINT: PRIMARY KEY must be unique'))).toBe(true);
	});

	// The reason this is narrower than "some unique index rejected the row". Every one of these tables
	// carries other unique indexes, and reporting one of them as a reused id tells the caller to change
	// a field that did not collide while saying nothing about the one that did.
	it('does not claim a composite index over identifier and type is the primary key', () => {
		expect(
			isPrimaryKeyCollision(
				queryFailed('UNIQUE constraint failed: devices_module_devices.identifier, devices_module_devices.type'),
			),
		).toBe(false);
	});

	it('does not claim a single-column index on another field is the primary key', () => {
		expect(isPrimaryKeyCollision(queryFailed('UNIQUE constraint failed: devices_module_channels.identifier'))).toBe(
			false,
		);
	});

	it('reads an unqualified column name', () => {
		expect(isPrimaryKeyCollision(queryFailed('UNIQUE constraint failed: id'))).toBe(true);
	});

	it('answers false for anything that is not a constraint failure', () => {
		expect(isPrimaryKeyCollision(queryFailed('SQLITE_BUSY: database is locked'))).toBe(false);
		expect(isPrimaryKeyCollision(new Error('something else'))).toBe(false);
		expect(isPrimaryKeyCollision('not an error')).toBe(false);
		expect(isPrimaryKeyCollision(undefined)).toBe(false);
	});
});
