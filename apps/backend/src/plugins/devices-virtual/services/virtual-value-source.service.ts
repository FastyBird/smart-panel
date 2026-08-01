import { Injectable } from '@nestjs/common';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { IPropertyValueSource } from '../../../modules/devices/services/property-value-source.registry.service';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';

@Injectable()
export class VirtualValueSourceService implements IPropertyValueSource {
	getType(): string {
		return DEVICES_VIRTUAL_TYPE;
	}

	resolve(property: ChannelPropertyEntity): string | null {
		if (!(property instanceof VirtualChannelPropertyEntity)) {
			return null;
		}

		// An owned property stores its own value. An orphaned one has no source left, so it also
		// falls back to its own — empty — series rather than silently reading someone else's
		// (sourcePropertyId is null there, which is what this returns).
		if (!property.isProjecting) {
			return null;
		}

		return property.sourcePropertyId;
	}
}
