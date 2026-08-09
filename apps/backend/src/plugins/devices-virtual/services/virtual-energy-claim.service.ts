import { Injectable } from '@nestjs/common';

import { EnergyClaim, IEnergyClaimSource } from '../../../modules/energy/services/energy-claim.registry.service';
import { findEnergySourceType } from '../../../modules/energy/utils/energy-source-type.utils';

import { VirtualPropertyIndexService } from './virtual-property-index.service';

/**
 * Tells the energy module which projection, if any, has taken over a meter.
 *
 * The whole answer already exists on the projection row — `energyClaimPropertyId`, settled when the
 * projection is written and released with the link it belongs to — so this is a thin adapter rather
 * than a second source of truth. What it adds is direction: the claim is stored on the *claimant* and
 * the ingestion arrives holding the *meter*, and this is the seam that lets it ask without core
 * knowing the column exists.
 *
 * Answered in a single read, down to the room. Splitting it — an id here, a device lookup there —
 * would put a remap between the two: a claimant repointed at another meter in that window would still
 * supply the device this meter's delta is billed to.
 */
@Injectable()
export class VirtualEnergyClaimService implements IEnergyClaimSource {
	constructor(private readonly index: VirtualPropertyIndexService) {}

	async resolveClaim(meterPropertyId: string): Promise<EnergyClaim | null> {
		const claimant = await this.index.findEnergyClaimant(meterPropertyId);

		if (!claimant) {
			return null;
		}

		const channel = typeof claimant.channel === 'string' ? undefined : claimant.channel;
		const device = channel?.device;

		if (!device || typeof device === 'string') {
			return null;
		}

		return {
			propertyId: claimant.id,
			deviceId: device.id,
			roomId: device.roomId ?? null,
			// The claimant's own slot, classified by the same function the ingestion classifies the meter
			// with, so the two answers are comparable and a claim that has drifted can be refused.
			sourceType: findEnergySourceType(channel?.category, claimant.category)?.sourceType ?? null,
		};
	}
}
