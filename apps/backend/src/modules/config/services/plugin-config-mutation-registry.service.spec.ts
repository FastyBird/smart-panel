import { ConfigException } from '../config.exceptions';
import { UpdatePluginConfigDto } from '../dto/config.dto';

import { PluginConfigMutationRegistryService } from './plugin-config-mutation-registry.service';

describe('PluginConfigMutationRegistryService', () => {
	let service: PluginConfigMutationRegistryService;

	beforeEach(() => {
		service = new PluginConfigMutationRegistryService();
	});

	it('commits updates without a registered handler', async () => {
		const commit = jest.fn();

		await service.execute('unregistered-plugin', { type: 'unregistered-plugin' }, commit);

		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('awaits the registered handler around the commit', async () => {
		const order: string[] = [];
		const update: UpdatePluginConfigDto = { type: 'secured-plugin', enabled: false };
		service.register('secured-plugin', async (registeredUpdate, commit) => {
			order.push(`before:${registeredUpdate.enabled}`);
			await commit();
			order.push('after');
		});

		await service.execute('secured-plugin', update, () => {
			order.push('commit');
		});

		expect(order).toEqual(['before:false', 'commit', 'after']);
	});

	it('rejects duplicate handlers for one plugin', () => {
		service.register('secured-plugin', async (_update, commit) => commit());

		expect(() => service.register('secured-plugin', async (_update, commit) => commit())).toThrow(ConfigException);
	});

	it('serializes overlapping updates for the same plugin', async () => {
		const order: string[] = [];
		let releaseFirst: (() => void) | undefined;
		const firstBlocked = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		service.register('secured-plugin', async (update, commit) => {
			order.push(`start:${update.enabled}`);

			if (update.enabled === true) await firstBlocked;

			await commit();
			order.push(`finish:${update.enabled}`);
		});

		const first = service.execute('secured-plugin', { type: 'secured-plugin', enabled: true }, () => {
			order.push('commit:true');
		});
		const second = service.execute('secured-plugin', { type: 'secured-plugin', enabled: false }, () => {
			order.push('commit:false');
		});
		await Promise.resolve();
		await Promise.resolve();

		expect(order).toEqual(['start:true']);
		releaseFirst?.();
		await Promise.all([first, second]);

		expect(order).toEqual(['start:true', 'commit:true', 'finish:true', 'start:false', 'commit:false', 'finish:false']);
	});

	it('continues the queue after a failed update', async () => {
		const first = service.execute('unregistered-plugin', { type: 'unregistered-plugin' }, () => {
			throw new Error('failed');
		});
		const secondCommit = jest.fn();
		const second = service.execute('unregistered-plugin', { type: 'unregistered-plugin' }, secondCommit);

		await expect(first).rejects.toThrow('failed');
		await expect(second).resolves.toBeUndefined();
		expect(secondCommit).toHaveBeenCalledTimes(1);
	});
});
