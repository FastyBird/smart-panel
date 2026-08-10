import { ConfigException } from '../config.exceptions';
import { UpdateModuleConfigDto } from '../dto/config.dto';

import { ModuleConfigMutationRegistryService } from './module-config-mutation-registry.service';

describe('ModuleConfigMutationRegistryService', () => {
	let service: ModuleConfigMutationRegistryService;

	beforeEach(() => {
		service = new ModuleConfigMutationRegistryService();
	});

	it('commits updates without a registered handler', async () => {
		const commit = jest.fn();

		await service.execute('unregistered-module', { type: 'unregistered-module' }, commit);

		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('awaits the registered handler around the commit', async () => {
		const order: string[] = [];
		const update: UpdateModuleConfigDto = { type: 'secured-module', enabled: false };
		service.register('secured-module', async (registeredUpdate, commit) => {
			order.push(`before:${registeredUpdate.enabled}`);
			await commit();
			order.push('after');
		});

		await service.execute('secured-module', update, () => {
			order.push('commit');
		});

		expect(order).toEqual(['before:false', 'commit', 'after']);
	});

	it('rejects duplicate handlers for one module', () => {
		service.register('secured-module', async (_update, commit) => commit());

		expect(() => service.register('secured-module', async (_update, commit) => commit())).toThrow(ConfigException);
	});
});
