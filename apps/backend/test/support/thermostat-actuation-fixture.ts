import { PlatformRegistryService } from '../../src/modules/devices/services/platform.registry.service';
import { PropertyValueService } from '../../src/modules/devices/services/property-value.service';
import { ShellyThermostatActuationExtension } from '../../src/plugins/devices-shelly-ng/services/shelly-thermostat-actuation-extension.service';
import { ThermostatActuationRegistry } from '../../src/plugins/devices-virtual/services/thermostat-actuation-registry.service';

/** Install the actual extension, including its qualification checks, into an isolated fixture registry. */
export function shellyThermostatActuationFixture(platforms?: PlatformRegistryService, values?: PropertyValueService) {
	const registry = new ThermostatActuationRegistry();
	new ShellyThermostatActuationExtension(registry, platforms, values).onModuleInit();
	return registry;
}
