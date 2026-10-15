import { Injectable } from '@nestjs/common';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyProducerQuality } from '../../../modules/devices/models/property-value-state.model';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';

export interface HomeKitPropertyState {
	readonly value: string | boolean | number | null;
	readonly quality: PropertyProducerQuality | null;
	readonly reasons: readonly string[];
	/** True only when a current process-local producer supplies the value. */
	readonly live: boolean;
	readonly unavailable: boolean;
}

/** Reads existing value authority; never refreshes a sample or invokes device control. */
@Injectable()
export class HomeKitPropertyStateService {
	constructor(
		private readonly producers: PropertyProducerRegistryService,
		private readonly sources: PropertyValueSourceRegistryService,
	) {}

	read(property: ChannelPropertyEntity): HomeKitPropertyState {
		try {
			const reason = this.sources.unavailableReason(property);
			if (reason) return this.unavailable([reason]);
			const key = this.sources.resolve(property);
			// Read, rather than diagnostic state, enforces expiry, clock and captured lifecycle guards.
			const produced = this.producers.read(key);
			if (produced) {
				if (produced.producer.quality === 'unavailable') return this.unavailable(produced.producer.reasons);
				if (!this.isValue(produced.value)) return this.unavailable(['invalid_producer_value']);
				return {
					value: produced.value,
					quality: produced.producer.quality,
					reasons: [...produced.producer.reasons],
					live: true,
					unavailable: false,
				};
			}
			if (this.sources.requiresLiveValue(property) || property.value?.producer)
				return this.unavailable(['producer_unavailable']);
			// Physical properties and legacy projections retain their existing cached-value policy.
			const value = property.value?.value;
			return {
				value: this.isValue(value) ? value : null,
				quality: null,
				reasons: [],
				live: false,
				unavailable: false,
			};
		} catch {
			// A failed resolver must never silently switch an alias to its historical local series.
			return this.unavailable(['value_source_unavailable']);
		}
	}

	private isValue(value: unknown): value is string | boolean | number {
		return (
			typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
		);
	}

	private unavailable(reasons: readonly string[]): HomeKitPropertyState {
		return { value: null, quality: 'unavailable', reasons: [...reasons], live: false, unavailable: true };
	}
}
