import { Test, TestingModule } from '@nestjs/testing';

import { CommandEventRegistryService } from './command-event-registry.service';

describe('CommandEventRegistryService', () => {
	let service: CommandEventRegistryService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [CommandEventRegistryService],
		}).compile();

		service = module.get<CommandEventRegistryService>(CommandEventRegistryService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('registerEvent', () => {
		it('should register a new event with a handler', () => {
			const mockHandler = { name: 'HandlerName', handler: jest.fn() };
			service.register('TestEvent', mockHandler.name, mockHandler.handler);

			expect(service.has('TestEvent')).toBe(true);
			expect(service.get('TestEvent')).toContainEqual(mockHandler);
		});

		it('should add multiple handlers for the same event', () => {
			const mockHandler1 = { name: 'Handler1Name', handler: jest.fn() };
			const mockHandler2 = { name: 'Handler2Name', handler: jest.fn() };

			service.register('TestEvent', mockHandler1.name, mockHandler1.handler);
			service.register('TestEvent', mockHandler2.name, mockHandler2.handler);

			const handlers = service.get('TestEvent');

			expect(handlers).toContainEqual(mockHandler1);
			expect(handlers).toContainEqual(mockHandler2);
			expect(handlers.length).toBe(2);
		});
	});

	describe('getHandlers', () => {
		it('should return an empty array if no handlers are registered for an event', () => {
			const handlers = service.get('NonExistentEvent');

			expect(handlers).toEqual([]);
		});

		it('should return all handlers for a registered event', () => {
			const mockHandler1 = { name: 'Handler1Name', handler: jest.fn() };
			const mockHandler2 = { name: 'Handler2Name', handler: jest.fn() };

			service.register('TestEvent', mockHandler1.name, mockHandler1.handler);
			service.register('TestEvent', mockHandler2.name, mockHandler2.handler);

			const handlers = service.get('TestEvent');

			expect(handlers).toContainEqual(mockHandler1);
			expect(handlers).toContainEqual(mockHandler2);
			expect(handlers.length).toBe(2);
		});
	});

	describe('hasHandlers', () => {
		it('should return false if no handlers are registered for an event', () => {
			expect(service.has('NonExistentEvent')).toBe(false);
		});

		it('should return true if handlers are registered for an event', () => {
			const mockHandler = jest.fn();
			service.register('TestEvent', 'HandlerName', mockHandler);

			expect(service.has('TestEvent')).toBe(true);
		});
	});
});
