import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { HomeAssistantDomain } from '../devices-home-assistant.constants';

export class HomeAssistantServiceResolver {
	static resolve(
		domain: HomeAssistantDomain,
		propertyCategory: PropertyCategory,
		value: string | number | boolean,
	): string | null {
		const serviceMap: Partial<
			Record<
				HomeAssistantDomain,
				Partial<Record<PropertyCategory, ((value: string | number | boolean) => string) | string>>
			>
		> = {
			[HomeAssistantDomain.LIGHT]: {
				[PropertyCategory.ON]: (val) => (val ? 'turn_on' : 'turn_off'),
				[PropertyCategory.BRIGHTNESS]: 'turn_on',
			},
			[HomeAssistantDomain.SWITCH]: {
				[PropertyCategory.ON]: (val) => (val ? 'turn_on' : 'turn_off'),
			},
			[HomeAssistantDomain.CLIMATE]: {
				[PropertyCategory.TEMPERATURE]: 'set_temperature',
			},
		};

		const domainServices = serviceMap[domain];

		if (!domainServices) {
			return null;
		}

		const serviceEntry = domainServices[propertyCategory];

		if (!serviceEntry) {
			return null;
		}

		return typeof serviceEntry === 'function' ? serviceEntry(value) : serviceEntry;
	}

	static resolveBatch(
		domain: HomeAssistantDomain,
		updates: { category: PropertyCategory; value: string | number | boolean }[],
	): string | null {
		for (const update of updates) {
			const service = this.resolve(domain, update.category, update.value);

			if (service) {
				return service;
			}
		}

		return null;
	}
}
