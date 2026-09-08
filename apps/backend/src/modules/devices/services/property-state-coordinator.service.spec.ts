import { PropertyStateCoordinatorService } from './property-state-coordinator.service';

describe('PropertyStateCoordinatorService', () => {
	it('keeps same-key publication ordered while unrelated properties overlap', async () => {
		const coordinator = new PropertyStateCoordinatorService();
		let releaseFirst!: () => void;
		const firstGate = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const order: string[] = [];

		const first = coordinator.run('property-a', async () => {
			order.push('a:first:start');
			await firstGate;
			order.push('a:first:end');
		});
		const second = coordinator.run('property-a', () => {
			order.push('a:second');

			return Promise.resolve();
		});
		const independent = coordinator.run('property-b', () => {
			order.push('b');

			return Promise.resolve();
		});

		await Promise.resolve();
		await Promise.resolve();
		expect(order).toEqual(['a:first:start', 'b']);

		releaseFirst();
		await Promise.all([first, second, independent]);
		expect(order).toEqual(['a:first:start', 'b', 'a:first:end', 'a:second']);
	});
});
