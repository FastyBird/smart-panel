import { DataSource } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualDewPointRuntimeService } from './virtual-dew-point-runtime.service';

describe('dew point Nest dependency injection and CLI lifecycle', () => {
	const compile = async (config?: ConfigService) => {
		const dataSource = { manager: { find: jest.fn() } };
		const graph = { observeValidation: jest.fn(() => () => undefined) };
		const module = await Test.createTestingModule({
			providers: [
				VirtualDewPointRuntimeService,
				{ provide: DataSource, useValue: dataSource },
				{ provide: PropertyProducerRegistryService, useValue: {} },
				{ provide: PropertyValueService, useValue: {} },
				{ provide: VirtualDependencyGraphService, useValue: graph },
				{ provide: DeviceConnectionStateService, useValue: {} },
				{ provide: EventEmitter2, useValue: new EventEmitter2() },
				...(config ? [{ provide: ConfigService, useValue: config }] : []),
			],
		}).compile();
		return { module, runtime: module.get(VirtualDewPointRuntimeService), dataSource, graph };
	};
	it('resolves without ConfigService provider and honors environment CLI gate without starting any runtime work', async () => {
		const previous = process.env.FB_CLI;
		process.env.FB_CLI = 'on';
		const f = await compile();
		const request = jest.spyOn(f.runtime, 'requestRecompute');
		try {
			await f.runtime.onApplicationBootstrap();
			expect(request).not.toHaveBeenCalled();
			expect(f.graph.observeValidation).not.toHaveBeenCalled();
			expect(f.dataSource.manager.find).not.toHaveBeenCalled();
		} finally {
			await f.module.close();
			if (previous === undefined) delete process.env.FB_CLI;
			else process.env.FB_CLI = previous;
		}
	});
	it('retains an explicitly injected ConfigService and its CLI=on value instead of replacing it with the fallback', async () => {
		const previous = process.env.FB_CLI;
		process.env.FB_CLI = 'off';
		const config = new ConfigService({ FB_CLI: 'on' }),
			get = jest.spyOn(config, 'get');
		const f = await compile(config);
		const request = jest.spyOn(f.runtime, 'requestRecompute');
		try {
			await f.runtime.onApplicationBootstrap();
			expect(get).toHaveBeenCalledWith('FB_CLI');
			expect(request).not.toHaveBeenCalled();
			expect(f.graph.observeValidation).not.toHaveBeenCalled();
			expect(f.dataSource.manager.find).not.toHaveBeenCalled();
		} finally {
			await f.module.close();
			if (previous === undefined) delete process.env.FB_CLI;
			else process.env.FB_CLI = previous;
		}
	});
	it('also retains an injected non-CLI configuration when the environment differs, with startup isolated from I/O', async () => {
		const previous = process.env.FB_CLI;
		process.env.FB_CLI = 'on';
		const f = await compile(new ConfigService({ FB_CLI: 'off' }));
		const request = jest.spyOn(f.runtime, 'requestRecompute').mockImplementation(() => undefined);
		try {
			await f.runtime.onApplicationBootstrap();
			expect(request).toHaveBeenCalledTimes(1);
			expect(f.graph.observeValidation).toHaveBeenCalledTimes(1);
			expect(f.dataSource.manager.find).not.toHaveBeenCalled();
		} finally {
			await f.module.close();
			if (previous === undefined) delete process.env.FB_CLI;
			else process.env.FB_CLI = previous;
		}
	});
});
