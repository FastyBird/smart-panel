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
});
