import { DevicesHomeAssistantPlugin } from './devices-home-assistant.plugin';

jest.mock('../../modules/devices/utils/schema.utils', () => ({
	channelsSchema: {},
	devicesSchema: {},
}));
jest.mock('./services/device-adoption.service', () => ({ DeviceAdoptionService: class DeviceAdoptionService {} }));
jest.mock('./services/mapping-preview.service', () => ({ MappingPreviewService: class MappingPreviewService {} }));
jest.mock('./subscribers/devices-service.subscriber', () => ({
	DevicesServiceSubscriber: class DevicesServiceSubscriber {},
}));

describe('DevicesHomeAssistantPlugin', () => {
	it('registers mappers, raw event handlers, and managed services', () => {
		const register = jest.fn();
		const genericRegistry = {
			register,
			registerMapping: jest.fn(),
			registerMapper: jest.fn(),
			registerPluginMetadata: jest.fn(),
		};
		const connector = { registerEventsHandler: jest.fn() };
		const discovery = {};
		const rawEventService = { event: '*' };

		const plugin = new DevicesHomeAssistantPlugin(
			genericRegistry as never, // configMapper
			genericRegistry as never, // devicesMapper
			genericRegistry as never, // channelsMapper
			genericRegistry as never, // channelsPropertiesMapper
			genericRegistry as never, // platformRegistryService
			{} as never, // homeAssistantDevicePlatform
			genericRegistry as never, // homeAssistantMapperService
			{} as never, // homeAssistantBinarySensorEntityMapper
			{} as never, // homeAssistantClimateEntityMapper
			{} as never, // homeAssistantCoverEntityMapper
			{} as never, // homeAssistantLightEntityMapper
			{} as never, // homeAssistantSensorEntityMapper
			{} as never, // homeAssistantSwitchEntityMapper
			{} as never, // homeAssistantButtonEntityMapper
			{} as never, // homeAssistantInputButtonEntityMapper
			connector as never, // homeAssistantWsService
			rawEventService as never, // homeAssistantRawEventService
			discovery as never, // haMdnsDiscovererService
			{ event: 'state_changed' } as never, // stateChangedEventService
			{} as never, // devicesServiceSubscriber
			genericRegistry as never, // swaggerRegistry
			genericRegistry as never, // discriminatorRegistry
			genericRegistry as never, // extensionsService
			genericRegistry as never, // managedServiceManager
		);

		plugin.onModuleInit();

		expect(register).toHaveBeenCalledWith(connector);
		expect(register).toHaveBeenCalledWith(discovery);
		expect(connector.registerEventsHandler).toHaveBeenCalledTimes(3);
		expect(connector.registerEventsHandler).toHaveBeenCalledWith('state_changed', expect.anything());
		expect(connector.registerEventsHandler).toHaveBeenCalledWith('zha_event', rawEventService);
		expect(connector.registerEventsHandler).toHaveBeenCalledWith('deconz_event', rawEventService);
	});
});
