import { Test, TestingModule } from '@nestjs/testing';

import { ExtensionNotConfigurableException } from '../extensions.exceptions';

import { ExtensionsBulkService } from './extensions-bulk.service';
import { ExtensionsService } from './extensions.service';

describe('ExtensionsBulkService', () => {
	let service: ExtensionsBulkService;
	let extensionsService: { updateEnabled: jest.Mock };

	beforeEach(async () => {
		extensionsService = { updateEnabled: jest.fn().mockResolvedValue(undefined) };

		const module: TestingModule = await Test.createTestingModule({
			providers: [ExtensionsBulkService, { provide: ExtensionsService, useValue: extensionsService }],
		}).compile();

		service = module.get<ExtensionsBulkService>(ExtensionsBulkService);
	});

	it('sets the requested state on every extension in the selection', async () => {
		const result = await service.setEnabled(['devices-wled-plugin', 'devices-shelly-ng-plugin'], true);

		expect(result.succeeded).toEqual(['devices-wled-plugin', 'devices-shelly-ng-plugin']);
		expect(result.failed).toEqual([]);
		expect(extensionsService.updateEnabled).toHaveBeenCalledWith('devices-wled-plugin', true);
		expect(extensionsService.updateEnabled).toHaveBeenCalledWith('devices-shelly-ng-plugin', true);
	});

	// The outcome is keyed by extension type, since that is how the single update
	// endpoint addresses them too - there is no generated id to report against.
	it('reports the failing extension by its type', async () => {
		extensionsService.updateEnabled.mockImplementation((type: string) =>
			type === 'devices-module' ? Promise.reject(new ExtensionNotConfigurableException(type)) : Promise.resolve(),
		);

		const result = await service.setEnabled(['devices-wled-plugin', 'devices-module'], false);

		expect(result.succeeded).toEqual(['devices-wled-plugin']);
		expect(result.failed).toEqual([
			{ id: 'devices-module', reason: "Extension 'devices-module' does not support enable/disable configuration." },
		]);
	});

	// A core extension refusing must not take the rest of the selection with it -
	// the admin's "disable all" is a set of independent intents.
	it('keeps going after a core extension refuses', async () => {
		extensionsService.updateEnabled.mockImplementation((type: string) =>
			type === 'core' ? Promise.reject(new ExtensionNotConfigurableException(type)) : Promise.resolve(),
		);

		const result = await service.setEnabled(['a', 'core', 'b'], false);

		expect(result.succeeded).toEqual(['a', 'b']);
		expect(extensionsService.updateEnabled).toHaveBeenCalledTimes(3);
	});

	it('passes the enabled flag through unchanged', async () => {
		await service.setEnabled(['a'], false);

		expect(extensionsService.updateEnabled).toHaveBeenCalledWith('a', false);
	});
});
