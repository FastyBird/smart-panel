import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ENERGY_MODULE_NAME, EnergySourceType } from '../energy.constants';

/**
 * Everything the ingestion needs to bill a claimed meter, read at one instant.
 *
 * Answered whole rather than as an id to look up afterwards, because the two reads that would take
 * are racing a remap: a claimant repointed at another meter between them would still supply the
 * device this meter's delta is billed to. One read cannot disagree with itself — it is whoever held
 * the claim when it ran, and where that device was.
 */
export interface EnergyClaim {
	/** The property presenting the meter, so a claimant can be told apart from a claim it does not hold. */
	propertyId: string;

	deviceId: string;

	roomId: string | null;

	/**
	 * What the claimant's own slot presents. The ingestion refuses to bill a claim that no longer reads
	 * what the meter reads rather than trusting the claim outright — a claim settled against one slot
	 * can outlive it, and moving kWh under a heading the claimant's own device contradicts is the
	 * failure this whole mechanism exists to prevent.
	 */
	sourceType: EnergySourceType | null;
}

/**
 * Answers "which property is accountable for this meter's kWh?".
 *
 * A meter is normally accountable for itself: the device holding it is where its consumption is
 * billed. A plugin may declare that some other property has taken that over — a virtual device
 * assembled from another device's channels presents the meter as its own, and the operator who split
 * a four-relay switch into four rooms expects each room to be billed for what it shows.
 *
 * Energy is the one reading where this cannot be left to each side to decide. A temperature read by
 * two devices is coherent; a kWh billed to two rooms is not. So there is exactly one accountable
 * property per meter, whoever holds it, and the ingestion asks rather than deciding for itself —
 * core stays unaware of any particular plugin, as it does for {@link IPropertyValueSource} next door.
 */
export interface IEnergyClaimSource {
	/**
	 * The claim on this meter, or null when this source claims nothing for it. Asked of storage rather
	 * than of a cache: a claim made moments ago decides where the very next reading is billed.
	 */
	resolveClaim(meterPropertyId: string): Promise<EnergyClaim | null>;
}

@Injectable()
export class EnergyClaimRegistryService {
	private readonly logger = createExtensionLogger(ENERGY_MODULE_NAME, 'EnergyClaimRegistryService');

	private readonly sources: IEnergyClaimSource[] = [];

	register(source: IEnergyClaimSource): boolean {
		if (this.sources.includes(source)) {
			this.logger.warn('Energy claim source already registered');

			return false;
		}

		this.sources.push(source);

		this.logger.log(`Registered new energy claim source count=${this.sources.length}`);

		return true;
	}

	/**
	 * The first claim any registered source reports, or null when the meter is unclaimed — which is
	 * every meter on an installation running no plugin that claims one.
	 *
	 * Throws when a source cannot answer, rather than reporting the meter as unclaimed. The two are
	 * not the same fact and the caller does not treat them the same: "nobody claims this" is a settled
	 * answer that decides where a reading is billed, while "I could not find out" leaves the decision
	 * open — and reading a failure as `null` is how a transient database error turns several
	 * projections of one meter into several deltas for one reading, permanently. See
	 * `EnergyIngestionListener.resolveAccounting()` for which way each branch fails.
	 */
	async resolveClaim(meterPropertyId: string): Promise<EnergyClaim | null> {
		for (const source of this.sources) {
			const claim = await source.resolveClaim(meterPropertyId);

			if (claim !== null) {
				return claim;
			}
		}

		return null;
	}
}
