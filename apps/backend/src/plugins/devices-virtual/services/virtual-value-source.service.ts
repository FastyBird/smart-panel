import { Injectable, Optional } from '@nestjs/common';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { IPropertyValueSource } from '../../../modules/devices/services/property-value-source.registry.service';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';

@Injectable()
export class VirtualValueSourceService implements IPropertyValueSource {
	constructor(@Optional() private readonly graph?: VirtualDependencyGraphService) {}
	getType(): string {
		return DEVICES_VIRTUAL_TYPE;
	}

	/** Projection reads also need validation even when no producer lease owns their alias. */
	unavailableReason(property: ChannelPropertyEntity): string | null {
		if (
			!(property instanceof VirtualChannelPropertyEntity) ||
			!(property.isProjecting || property.isDerived) ||
			!this.graph
		)
			return null;
		if (!this.graph.isValidated()) return 'graph_validation_pending';
		if (this.graph.isQuarantined(property.id)) return 'graph_quarantined';
		return null;
	}

	/** Canonical policy uses the graph's validated metadata, never the alias's historical value. */
	requiresLiveValue(property: ChannelPropertyEntity): boolean | null {
		if (!(property instanceof VirtualChannelPropertyEntity) || !property.isProjecting) return null;
		if (!property.sourcePropertyId) return true;
		return this.graph?.propertyRequiresLiveValue(property.sourcePropertyId) ?? null;
	}

	resolve(property: ChannelPropertyEntity): string | null {
		if (!(property instanceof VirtualChannelPropertyEntity)) {
			return null;
		}

		// An owned property stores its own value. An orphaned one has no source left, so it also
		// falls back to its own — empty — series rather than silently reading someone else's
		// (sourcePropertyId is null there, which is what this returns).
		if (this.graph?.isQuarantined(property.id) || !property.isProjecting) {
			return null;
		}

		return property.sourcePropertyId;
	}
}
