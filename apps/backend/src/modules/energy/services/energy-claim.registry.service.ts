import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ENERGY_MODULE_NAME } from '../energy.constants';

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
 * core stays unaware of any particular plugin, as it does for
 * {@link IPropertyValueSource} next door.
 */
export interface IEnergyClaimSource {
	/**
	 * The id of the property accountable for this meter, or null when this source claims nothing for
	 * it. Asked of storage rather than of a cache: a claim made moments ago decides where the very
	 * next reading is billed.
	 */
	resolveClaimant(meterPropertyId: string): Promise<string | null>;
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
	 * A source that throws is read as claiming nothing rather than failing the reading. Attribution
	 * then falls back to the device holding the meter, which is where it went before any of this
	 * existed; losing the sample instead would be a worse answer to a lookup that is only ever about
	 * *whose* kWh it is.
	 */
	async resolveClaimant(meterPropertyId: string): Promise<string | null> {
		for (const source of this.sources) {
			try {
				const claimant = await source.resolveClaimant(meterPropertyId);

				if (claimant !== null) {
					return claimant;
				}
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Failed to resolve energy claimant for property ${meterPropertyId}: ${err.message}`);
			}
		}

		return null;
	}
}
