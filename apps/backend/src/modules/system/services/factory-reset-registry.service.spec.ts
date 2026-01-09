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

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('registerHandler', () => {
		it('should register a new factory reset handler', () => {
			const mockHandler = { name: 'HandlerName', priority: 10, handler: jest.fn() };
			service.register(mockHandler.name, mockHandler.handler, mockHandler.priority);

			expect(service.has('HandlerName')).toBe(true);
			expect(service.get()).toContainEqual(mockHandler);
		});

		it('should add multiple handlers', () => {
			const mockHandler1 = { name: 'Handler1Name', priority: 10, handler: jest.fn() };
			const mockHandler2 = { name: 'Handler2Name', priority: 20, handler: jest.fn() };

			service.register(mockHandler1.name, mockHandler1.handler, mockHandler1.priority);
			service.register(mockHandler2.name, mockHandler2.handler, mockHandler2.priority);

			const handlers = service.get();

			expect(handlers).toContainEqual(mockHandler1);
			expect(handlers).toContainEqual(mockHandler2);
			expect(handlers.length).toBe(2);
		});
	});

	describe('getHandlers', () => {
		it('should return all handlers for a registered event', () => {
			const mockHandler1 = { name: 'Handler1Name', priority: 20, handler: jest.fn() };
			const mockHandler2 = { name: 'Handler2Name', priority: 10, handler: jest.fn() };

			service.register(mockHandler1.name, mockHandler1.handler, mockHandler1.priority);
			service.register(mockHandler2.name, mockHandler2.handler, mockHandler2.priority);

			const handlers = service.get();

			expect(handlers).toContainEqual(mockHandler1);
			expect(handlers).toContainEqual(mockHandler2);
			expect(handlers.length).toBe(2);
		});
	});

	describe('hasHandlers', () => {
		it('should return false if no handler is registered', () => {
			expect(service.has('NonExistentHandler')).toBe(false);
		});

		it('should return true if handler is registered', () => {
			const mockHandler = jest.fn();
			service.register('HandlerName', mockHandler, 10);

			expect(service.has('HandlerName')).toBe(true);
		});
	});
});
