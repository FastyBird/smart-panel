import { PropertyCommandEntrySnapshot } from './property-command-entry-snapshot';
import { PropertyCommandWindowService } from './property-command-window.service';

const open = (windows: PropertyCommandWindowService, id: string) =>
	windows.open({
		canonicalTarget: { deviceId: 'device', channelId: 'channel', propertyId: id },
		requestedTargets: [],
		commandedValue: false,
		previousValue: true,
		ttlMs: 1000,
	});
describe('bounded command entry evidence', () => {
	it('retains a power command opened and closed during metadata and budget awaits without retaining window tombstones', async () => {
		const windows = new PropertyCommandWindowService();
		const entry = PropertyCommandEntrySnapshot.capture(windows, () => undefined);
		await Promise.resolve();
		windows.close(open(windows, 'power'));
		expect(windows.get('power')).toBeNull();
		expect(entry.canPreservePower('power')).toBe(false);
		expect(entry.canPreservePower('other')).toBe(true);
		entry.dispose();
		expect(entry.isActive()).toBe(false);
	});
	it('records pending power at entry even after that window confirms and closes', () => {
		const windows = new PropertyCommandWindowService();
		const previous = open(windows, 'power');
		const entry = PropertyCommandEntrySnapshot.capture(windows, () => undefined);
		windows.confirm(previous, { value: false, receivedAt: Date.now() });
		windows.close(previous);
		expect(entry.canPreservePower('power')).toBe(false);
		entry.dispose();
	});
	it('refuses preservation conservatively on overflow and disposes at the request deadline', () => {
		jest.useFakeTimers();
		try {
			const windows = new PropertyCommandWindowService();
			const disposed = jest.fn();
			const entry = PropertyCommandEntrySnapshot.capture(windows, disposed);
			for (let i = 0; i <= 2048; i++) windows.close(open(windows, String(i)));
			expect(entry.canPreservePower('unseen')).toBe(false);
			jest.advanceTimersByTime(30_000);
			expect(disposed).toHaveBeenCalledTimes(1);
			expect(entry.isActive()).toBe(false);
		} finally {
			jest.useRealTimers();
		}
	});
});
