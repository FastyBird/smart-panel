import { Injectable } from '@nestjs/common';

import { HomeyPropertyMappingBinding } from './mapping.types';

@Injectable()
export class HomeyPropertyMappingStorageService {
	private readonly bindings = new Map<string, HomeyPropertyMappingBinding>();

	store(propertyId: string, binding: HomeyPropertyMappingBinding): void {
		this.bindings.set(propertyId, binding);
	}

	get(propertyId: string): HomeyPropertyMappingBinding | undefined {
		return this.bindings.get(propertyId);
	}

	remove(propertyId: string): void {
		this.bindings.delete(propertyId);
	}

	findByCapability(homeyDeviceId: string, capabilityId: string): readonly HomeyPropertyMappingBinding[] {
		return [...this.bindings.values()].filter(
			(binding) => binding.homeyDeviceId === homeyDeviceId && binding.capabilityId === capabilityId,
		);
	}

	clear(): void {
		this.bindings.clear();
	}

	get size(): number {
		return this.bindings.size;
	}
}
