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
	it('registers both the owner-enabled connector and always-active discovery runtime', () => {
		const register = jest.fn();
		const genericRegistry = {
			register,
			registerMapping: jest.fn(),
			registerMapper: jest.fn(),
			registerPluginMetadata: jest.fn(),
		};
		const connector = { registerEventsHandler: jest.fn() };
		const discovery = {};
		const plugin = new DevicesHomeAssistantPlugin(
			genericRegistry as never,
			genericRegistry as never,
			genericRegistry as never,
			genericRegistry as never,
			genericRegistry as never,
			{} as never,
			genericRegistry as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			connector as never,
			discovery as never,
			{ event: 'state-changed' } as never,
			{} as never,
			genericRegistry as never,
			genericRegistry as never,
			genericRegistry as never,
			genericRegistry as never,
		);

		plugin.onModuleInit();

		expect(register).toHaveBeenCalledWith(connector);
		expect(register).toHaveBeenCalledWith(discovery);
		expect(connector.registerEventsHandler).toHaveBeenCalledTimes(1);
	});
});
