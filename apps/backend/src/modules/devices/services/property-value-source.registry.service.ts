import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';

/**
 * Answers "where does this property's value live?".
 *
 * A property normally stores its value under its own id. A plugin may declare that some of its
 * properties read and write another property's series instead — for example a device assembled
 * from properties of other devices. Core stays unaware of any particular plugin: it only asks.
 */
export interface IPropertyValueSource {
	/** Entity discriminator this source applies to, matching `ChannelPropertyEntity.type`. */
	getType(): string;

	/** Storage key for the property, or null to use the property's own id. */
	resolve(property: ChannelPropertyEntity): string | null;
}

@Injectable()
export class PropertyValueSourceRegistryService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PropertyValueSourceRegistryService');

	private readonly sources: Record<string, IPropertyValueSource> = {};

	register(source: IPropertyValueSource): boolean {
		const type = source.getType();

		if (type in this.sources) {
			this.logger.warn(`Value source already registered type=${type}`);

			return false;
		}

		this.sources[type] = source;

		this.logger.log(`Registered new value source type=${type}`);

		return true;
	}

	/**
	 * Storage key for the property. Falls back to the property's own id when no plugin claims it,
	 * so an unregistered or orphaned property simply owns its series.
	 */
	resolve(property: ChannelPropertyEntity): string {
		return this.sources[property.type]?.resolve(property) ?? property.id;
	}

	/** True when the property's value is stored under a different property's key. */
	isProjected(property: ChannelPropertyEntity): boolean {
		return this.resolve(property) !== property.id;
	}

	list(): string[] {
		return Object.keys(this.sources);
	}
}
