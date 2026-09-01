import { SpacesHomeControlPlugin } from './spaces-home-control.plugin';

jest.mock('../../modules/devices/utils/schema.utils', () => ({
	channelsSchema: {},
	devicesSchema: {},
}));

describe('SpacesHomeControlPlugin', () => {
	it('registers the suggestion heartbeat as an owner-enabled managed runtime', () => {
		const register = jest.fn();
		const genericRegistry = {
			register,
			registerMapping: jest.fn(),
			registerPluginMetadata: jest.fn(),
		};
		const heartbeat = {};
		const plugin = new SpacesHomeControlPlugin(
			genericRegistry as never,
			genericRegistry as never,
			genericRegistry as never,
			genericRegistry as never,
			genericRegistry as never,
			genericRegistry as never,
			{} as never,
			genericRegistry as never,
			genericRegistry as never,
			genericRegistry as never,
			{} as never,
			genericRegistry as never,
			{} as never,
			heartbeat as never,
		);

		plugin.onModuleInit();

		expect(register).toHaveBeenCalledWith(heartbeat);
	});
});
