import { Injectable, OnModuleDestroy } from '@nestjs/common';

import {
	ClimateAutomationCapturedRegistration,
	ClimateAutomationOwnedRegistration,
	ClimateAutomationProducer,
	ClimateAutomationProvider,
} from '../contracts/climate-automation.contract';

interface Registration<T> { readonly implementation: T; }

/** Dormant inward port. No production producer/provider is registered by this module. */
@Injectable()
export class ClimateAutomationRegistryService implements OnModuleDestroy {
	private readonly producers = new Map<string, Registration<ClimateAutomationProducer>>();
	private readonly providers = new Map<string, Registration<ClimateAutomationProvider>>();
	private destroyed = false;

	registerProducerOwned(key: string, implementation: ClimateAutomationProducer): ClimateAutomationOwnedRegistration | null {
		return this.register(this.producers, key, implementation);
	}
	registerProviderOwned(key: string, implementation: ClimateAutomationProvider): ClimateAutomationOwnedRegistration | null {
		return this.register(this.providers, key, implementation);
	}
	captureProducer(key: string): ClimateAutomationCapturedRegistration<ClimateAutomationProducer> | null {
		return this.capture(this.producers, key);
	}
	captureProvider(key: string): ClimateAutomationCapturedRegistration<ClimateAutomationProvider> | null {
		return this.capture(this.providers, key);
	}
	onModuleDestroy(): void {
		this.destroyed = true;
		this.producers.clear();
		this.providers.clear();
	}
	private register<T>(map: Map<string, Registration<T>>, key: string, implementation: T): ClimateAutomationOwnedRegistration | null {
		if (!/^[a-z][a-z0-9.-]*:v[1-9][0-9]*$/.test(key)) throw new Error('Invalid internal climate registration key');
		if (this.destroyed || map.has(key)) return null;
		const registration = Object.freeze({ implementation });
		map.set(key, registration);
		return Object.freeze({ dispose: () => { if (map.get(key) === registration) map.delete(key); } });
	}
	private capture<T>(map: Map<string, Registration<T>>, key: string): ClimateAutomationCapturedRegistration<T> | null {
		const registration = map.get(key);
		if (this.destroyed || !registration) return null;
		return Object.freeze({
			implementation: registration.implementation,
			isCurrent: () => !this.destroyed && map.get(key) === registration,
		});
	}
}
