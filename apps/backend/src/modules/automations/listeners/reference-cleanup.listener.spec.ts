import { AutomationNodeReference } from '../graph/node-type';
import { AutomationEngineService } from '../services/automation-engine.service';
import { flush } from '../testing/engine-harness';

import { ReferenceCleanupListener } from './reference-cleanup.listener';

describe('ReferenceCleanupListener', () => {
	let matchers: ((reference: AutomationNodeReference) => boolean)[];
	let invalidateReferences: jest.Mock;
	let listener: ReferenceCleanupListener;

	const matches = (kind: AutomationNodeReference['kind'], id: string): boolean =>
		matchers[matchers.length - 1]({ kind, id });

	beforeEach(() => {
		matchers = [];
		invalidateReferences = jest.fn((matcher: (reference: AutomationNodeReference) => boolean) => {
			matchers.push(matcher);

			return Promise.resolve(['automation-1']);
		});
		listener = new ReferenceCleanupListener({ invalidateReferences } as unknown as AutomationEngineService);
	});

	it('a deleted device takes its channels and their properties with it', () => {
		listener.handleDeviceDeleted({
			id: 'device-1',
			channels: [
				{ id: 'channel-1', properties: [{ id: 'property-1' }, { id: 'property-2' }] },
				{ id: 'channel-2', properties: [] },
			],
		});

		expect(matches('device', 'device-1')).toBe(true);
		expect(matches('channel', 'channel-1')).toBe(true);
		expect(matches('channel', 'channel-2')).toBe(true);
		expect(matches('property', 'property-2')).toBe(true);
		expect(matches('property', 'device-1')).toBe(false);
		expect(matches('device', 'device-2')).toBe(false);
		expect(matches('scene', 'device-1')).toBe(false);
	});

	it('a deleted device whose channels are not loaded still invalidates by its own id', () => {
		listener.handleDeviceDeleted({ id: 'device-1' });

		expect(matches('device', 'device-1')).toBe(true);
		expect(matches('channel', 'channel-1')).toBe(false);
	});

	it('a deleted channel takes its properties with it', () => {
		listener.handleChannelDeleted({ id: 'channel-1', properties: [{ id: 'property-1' }] });

		expect(matches('channel', 'channel-1')).toBe(true);
		expect(matches('property', 'property-1')).toBe(true);
		expect(matches('device', 'channel-1')).toBe(false);
	});

	it('a deleted property, scene or space invalidates by its id', () => {
		listener.handlePropertyDeleted({ id: 'property-1' });
		expect(matches('property', 'property-1')).toBe(true);
		expect(matches('property', 'property-2')).toBe(false);

		listener.handleSceneDeleted({ id: 'scene-1' });
		expect(matches('scene', 'scene-1')).toBe(true);
		expect(matches('space', 'scene-1')).toBe(false);

		listener.handleSpaceDeleted({ id: 'space-1' });
		expect(matches('space', 'space-1')).toBe(true);
	});

	it('a reset of the devices or the scenes module invalidates every reference of those kinds', () => {
		listener.handleDevicesReset();

		expect(matches('device', 'any')).toBe(true);
		expect(matches('channel', 'any')).toBe(true);
		expect(matches('property', 'any')).toBe(true);
		expect(matches('scene', 'any')).toBe(false);

		listener.handleScenesReset();

		expect(matches('scene', 'any')).toBe(true);
		expect(matches('device', 'any')).toBe(false);
	});

	it('ignores a payload without an id', () => {
		listener.handleDeviceDeleted(null);
		listener.handleChannelDeleted({});
		listener.handlePropertyDeleted({ id: 42 });
		listener.handleSceneDeleted({ id: '' });
		listener.handleSpaceDeleted(null);

		expect(invalidateReferences).not.toHaveBeenCalled();
	});

	it('never throws back into the bus when the engine fails', async () => {
		invalidateReferences.mockReturnValue(Promise.reject(new Error('engine broke')));

		expect(() => listener.handleSceneDeleted({ id: 'scene-1' })).not.toThrow();

		await flush();
	});
});
