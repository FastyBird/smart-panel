import { Injectable } from '@nestjs/common';

import { IEnergyClaimSource } from '../../../modules/energy/services/energy-claim.registry.service';

import { VirtualPropertyIndexService } from './virtual-property-index.service';

/**
 * Tells the energy module which projection, if any, has taken over a meter.
 *
 * The whole answer already exists on the projection row — `energyClaimPropertyId`, settled when the
 * projection is written and released with the link it belongs to — so this is a thin adapter rather
 * than a second source of truth. What it adds is direction: the claim is stored on the *claimant* and
 * the ingestion arrives holding the *meter*, and this is the seam that lets it ask without core
 * knowing the column exists.
 */
@Injectable()
export class VirtualEnergyClaimService implements IEnergyClaimSource {
	constructor(private readonly index: VirtualPropertyIndexService) {}

	async resolveClaimant(meterPropertyId: string): Promise<string | null> {
		return await this.index.findEnergyClaimant(meterPropertyId);
	}
}
