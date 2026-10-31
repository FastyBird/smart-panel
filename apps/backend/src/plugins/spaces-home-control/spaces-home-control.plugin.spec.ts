import { SpacesHomeControlPlugin } from './spaces-home-control.plugin';

jest.mock('../../modules/devices/utils/schema.utils', () => ({
	channelsSchema: {},
	devicesSchema: {},
}));

describe('SpacesHomeControlPlugin', () => {
	it('registers suggestions and activity scheduling as owner-enabled managed runtimes', () => {
		const register = jest.fn();
		const genericRegistry = {
			register,
			registerMapping: jest.fn(),
			registerPluginMetadata: jest.fn(),
		};
		const heartbeat = {};
		const scheduler = {};
		const occupancy = {};
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
			scheduler as never,
			occupancy as never,
		);

		plugin.onModuleInit();

		expect(register).toHaveBeenCalledWith(heartbeat);
		expect(register).toHaveBeenCalledWith(scheduler);
		expect(register).toHaveBeenCalledWith(occupancy);
	});
});
