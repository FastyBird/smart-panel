import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

import {
	PropertyCommandAdmissionRegistryService,
	PropertyCommandEffect,
} from './property-command-admission.registry.service';
import { PropertyCommandEntrySnapshot } from './property-command-entry-snapshot';
import { PropertyCommandWindowService } from './property-command-window.service';

const effect: PropertyCommandEffect = {
	device: Object.assign(new DeviceEntity(), { id: 'device' }),
	channel: Object.assign(new ChannelEntity(), { id: 'cover' }),
	property: Object.assign(new ChannelPropertyEntity(), { id: 'position' }),
	kind: 'cover_action',
	action: 'stop',
};
describe('typed physical effect admission', () => {
	it('fails closed for guards that do not explicitly support a cover effect', async () => {
		const registry = new PropertyCommandAdmissionRegistryService();
		registry.register({ assertAllowed: () => Promise.resolve() });
		const snapshot = registry.capture();
		expect(snapshot.isEffectCurrent(effect)).toBe(false);
		await expect(snapshot.assertEffectAllowed(effect)).rejects.toThrow('unsupported');
		const entry = PropertyCommandEntrySnapshot.capture(
			new PropertyCommandWindowService(),
			() => undefined,
			false,
			snapshot,
		);
		try {
			await expect(entry.assertEffectAllowed(effect)).rejects.toThrow('unsupported');
		} finally {
			entry.dispose();
		}
	});
	it('checks a captured effect independently from the requested scalar and fences ownership/membership changes', async () => {
		const registry = new PropertyCommandAdmissionRegistryService();
		let revision = 1;
		const checked = jest.fn((_effect: PropertyCommandEffect) => Promise.resolve());
		const unregister = registry.register({
			assertAllowed: () => Promise.resolve(),
			capture: () => {
				const captured = revision;
				return {
					isCurrent: () => true,
					assertAllowed: () => Promise.resolve(),
					isEffectCurrent: () => revision === captured,
					assertEffectAllowed: checked,
				};
			},
		});
		const snapshot = registry.capture();
		await snapshot.assertEffectAllowed(effect);
		expect(checked).toHaveBeenCalledWith(effect);
		expect('value' in effect).toBe(false);
		revision++;
		const entry = PropertyCommandEntrySnapshot.capture(
			new PropertyCommandWindowService(),
			() => undefined,
			false,
			snapshot,
		);
		try {
			expect(entry.isActive()).toBe(true);
			expect(entry.isEffectActive(effect)).toBe(false);
		} finally {
			entry.dispose();
		}
		unregister();
		expect(snapshot.isEffectCurrent(effect)).toBe(false);
	});
});
