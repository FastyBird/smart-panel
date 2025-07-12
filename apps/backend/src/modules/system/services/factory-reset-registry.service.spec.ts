import { Test, TestingModule } from '@nestjs/testing';

import { FactoryResetRegistryService } from './factory-reset-registry.service';

describe('FactoryResetRegistryService', () => {
	let service: FactoryResetRegistryService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [FactoryResetRegistryService],
		}).compile();

		service = module.get<FactoryResetRegistryService>(FactoryResetRegistryService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('registerHandler', () => {
		it('should register a new factory reset handler', () => {
			const mockHandler = { name: 'HandlerName', handler: jest.fn() };
			service.register(mockHandler.name, 10, mockHandler.handler);

			expect(service.has('HandlerName')).toBe(true);
			expect(service.get()).toContainEqual(mockHandler);
		});

		it('should add multiple handlers', () => {
			const mockHandler1 = { name: 'Handler1Name', handler: jest.fn() };
			const mockHandler2 = { name: 'Handler2Name', handler: jest.fn() };

			service.register(mockHandler1.name, 10, mockHandler1.handler);
			service.register(mockHandler2.name, 20, mockHandler2.handler);

			const handlers = service.get();

			expect(handlers).toContainEqual({ priority: 10, handler: mockHandler1 });
			expect(handlers).toContainEqual({ priority: 20, handler: mockHandler2 });
			expect(handlers.length).toBe(2);
		});
	});

	describe('getHandlers', () => {
		it('should return all handlers for a registered event', () => {
			const mockHandler1 = { name: 'Handler1Name', handler: jest.fn() };
			const mockHandler2 = { name: 'Handler2Name', handler: jest.fn() };

			service.register(mockHandler1.name, 20, mockHandler1.handler);
			service.register(mockHandler2.name, 10, mockHandler2.handler);

			const handlers = service.get();

			expect(handlers).toContainEqual({ priority: 20, handler: mockHandler1 });
			expect(handlers).toContainEqual({ priority: 10, handler: mockHandler2 });
			expect(handlers.length).toBe(2);
		});
	});

	describe('hasHandlers', () => {
		it('should return false if no handler is registered', () => {
			expect(service.has('NonExistentHandler')).toBe(false);
		});

		it('should return true if handler is registered', () => {
			const mockHandler = jest.fn();
			service.register('HandlerName', 10, mockHandler);

			expect(service.has('HandlerName')).toBe(true);
		});
	});
});
