import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { EnergySourceType } from '../../../modules/energy/energy.constants';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';

import { VirtualEnergyClaimService } from './virtual-energy-claim.service';
import { VirtualPropertyIndexService } from './virtual-property-index.service';

/**
 * The seam the energy module asks across. What matters here is that a claim is answered *whole*:
 * the ingestion is holding a meter and needs the room its kWh is billed to, and any answer it has to
 * follow up on is an answer that can be overtaken by a remap in between.
 */
describe('VirtualEnergyClaimService', () => {
	const claimant = (category: PropertyCategory, channelCategory: ChannelCategory, roomId: string | null) =>
		({
			id: 'claimant',
			category,
			channel: { id: 'virtual-channel', category: channelCategory, device: { id: 'virtual-device', roomId } },
		}) as unknown as VirtualChannelPropertyEntity;

	const subject = (found: VirtualChannelPropertyEntity | null): VirtualEnergyClaimService =>
		new VirtualEnergyClaimService({
			findEnergyClaimant: jest.fn().mockResolvedValue(found),
		} as unknown as VirtualPropertyIndexService);

	it('answers the claim whole: the device, its room, and what the claimant presents', async () => {
		const claim = await subject(
			claimant(PropertyCategory.CONSUMPTION, ChannelCategory.ELECTRICAL_ENERGY, 'kitchen'),
		).resolveClaim('meter');

		expect(claim).toEqual({
			propertyId: 'claimant',
			deviceId: 'virtual-device',
			roomId: 'kitchen',
			sourceType: EnergySourceType.CONSUMPTION_IMPORT,
		});
	});

	// Reported rather than hidden, because the ingestion refuses a claim that does not read what the
	// meter reads: a claimant whose slot has drifted must not quietly take the kWh with it.
	it('reports what a claimant presents even when that is not energy at all', async () => {
		const claim = await subject(claimant(PropertyCategory.ON, ChannelCategory.LIGHT, 'kitchen')).resolveClaim('meter');

		expect(claim?.sourceType).toBeNull();
	});

	it('claims nothing for a meter no projection holds', async () => {
		await expect(subject(null).resolveClaim('meter')).resolves.toBeNull();
	});

	// A claim is only about attribution, so a claimant that cannot be resolved to a device leaves the
	// meter billed to itself rather than costing the reading.
	it('claims nothing when the claimant resolves to no device', async () => {
		const orphan = { id: 'claimant', category: PropertyCategory.CONSUMPTION, channel: 'virtual-channel' };

		await expect(subject(orphan as unknown as VirtualChannelPropertyEntity).resolveClaim('meter')).resolves.toBeNull();
	});
});
