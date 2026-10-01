import { SpaceActivityService } from './space-activity.service';

describe('SpaceActivityService', () => {
	it('retains the latest observation when asynchronous reports finish out of order', () => {
		const service = new SpaceActivityService();
		const current = new Date('2026-10-01T12:00:00Z');
		service.record('room', current);
		service.record('room', new Date(current.getTime() - 1000));
		current.setUTCFullYear(2000);
		const space = { id: 'room', lastActivityAt: null };
		expect(service.readLatest(space)).toEqual(new Date('2026-10-01T12:00:00Z'));
		(service.readLatest(space) as Date).setUTCFullYear(1999);
		expect(service.readLatest(space)).toEqual(new Date('2026-10-01T12:00:00Z'));
	});

	it('preserves legacy timestamps and does not regress after a clock correction', () => {
		const service = new SpaceActivityService();
		const space = { id: 'room', lastActivityAt: '2026-10-01T12:00:00Z' };
		expect(service.readLatest(space)).toBe(space.lastActivityAt);
		service.record(space.id, new Date('2026-10-01T11:00:00Z'));
		expect(service.readLatest(space)).toEqual(new Date(space.lastActivityAt));
		service.record(space.id, new Date('2026-10-01T13:00:00Z'));
		expect(service.readLatest(space)).toEqual(new Date('2026-10-01T13:00:00Z'));
	});

	it('keeps rooms isolated and returns to the legacy baseline after reset or process shutdown', () => {
		const service = new SpaceActivityService();
		const room = { id: 'room', lastActivityAt: null };
		const other = { id: 'other', lastActivityAt: null };
		service.record(room.id, new Date());
		service.record(other.id, new Date());
		service.delete(room.id);
		expect(service.readLatest(room)).toBeNull();
		expect(service.readLatest(other)).toBeInstanceOf(Date);
		service.clear();
		expect(service.readLatest(other)).toBeNull();
		service.record(room.id, new Date());
		service.onModuleDestroy();
		expect(service.readLatest(room)).toBeNull();
		expect(new SpaceActivityService().readLatest(room)).toBeNull();
	});

	it('ignores invalid observations', () => {
		const service = new SpaceActivityService();
		service.record('room', new Date(Number.NaN));
		expect(service.readLatest({ id: 'room', lastActivityAt: null })).toBeNull();
	});
});
