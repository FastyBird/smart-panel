import { BuddyContextService } from '../services/buddy-context.service';

import { BuddyContextCacheListener } from './buddy-context-cache.listener';

describe('BuddyContextCacheListener', () => {
	let listener: BuddyContextCacheListener;
	let contextService: Record<string, jest.Mock>;

	beforeEach(() => {
		contextService = {
			invalidateCache: jest.fn(),
		};

		listener = new BuddyContextCacheListener(contextService as unknown as BuddyContextService);
	});

	it('should invalidate cache on device property value set', () => {
		listener.handleDevicePropertyValueSet();

		expect(contextService.invalidateCache).toHaveBeenCalledTimes(1);
	});

	it('should invalidate cache on device created', () => {
		listener.handleDeviceCreated();

		expect(contextService.invalidateCache).toHaveBeenCalledTimes(1);
	});

	it('should invalidate cache on device updated', () => {
		listener.handleDeviceUpdated();

		expect(contextService.invalidateCache).toHaveBeenCalledTimes(1);
	});

	it('should invalidate cache on device deleted', () => {
		listener.handleDeviceDeleted();

		expect(contextService.invalidateCache).toHaveBeenCalledTimes(1);
	});

	it('should invalidate cache on scene created', () => {
		listener.handleSceneCreated();

		expect(contextService.invalidateCache).toHaveBeenCalledTimes(1);
	});

	it('should invalidate cache on scene updated', () => {
		listener.handleSceneUpdated();

		expect(contextService.invalidateCache).toHaveBeenCalledTimes(1);
	});

	it('should invalidate cache on scene deleted', () => {
		listener.handleSceneDeleted();

		expect(contextService.invalidateCache).toHaveBeenCalledTimes(1);
	});

	it('should invalidate cache on space created', () => {
		listener.handleSpaceCreated();

		expect(contextService.invalidateCache).toHaveBeenCalledTimes(1);
	});

	it('should invalidate cache on space updated', () => {
		listener.handleSpaceUpdated();

		expect(contextService.invalidateCache).toHaveBeenCalledTimes(1);
	});

	it('should invalidate cache on space deleted', () => {
		listener.handleSpaceDeleted();

		expect(contextService.invalidateCache).toHaveBeenCalledTimes(1);
	});

	it('should invalidate cache on weather info', () => {
		listener.handleWeatherInfo();

		expect(contextService.invalidateCache).toHaveBeenCalledTimes(1);
	});

	it('should invalidate cache on intent completed', () => {
		listener.handleIntentCompleted();

		expect(contextService.invalidateCache).toHaveBeenCalledTimes(1);
	});
});
