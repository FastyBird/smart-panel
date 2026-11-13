import { CAMERAS_MODULE_NAME } from './cameras.constants';
import { CamerasModule } from './cameras.module';
import { CAMERAS_SWAGGER_EXTRA_MODELS } from './cameras.openapi';
import { UpdateCamerasConfigDto } from './dto/update-config.dto';
import { CamerasConfigModel } from './models/config.model';

describe('CamerasModule', () => {
	it('registers its config mapping and module metadata', () => {
		const mapper = { registerMapping: jest.fn() };
		const extensions = { registerModuleMetadata: jest.fn() };
		const swagger = { register: jest.fn() };
		const mutations = { register: jest.fn() };
		const module = new CamerasModule(
			swagger as never,
			mapper as never,
			extensions as never,
			mutations as never,
			{ update: jest.fn() } as never,
		);

		module.onModuleInit();

		expect(mapper.registerMapping).toHaveBeenCalledWith({
			type: CAMERAS_MODULE_NAME,
			class: CamerasConfigModel,
			configDto: UpdateCamerasConfigDto,
		});
		expect(extensions.registerModuleMetadata).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'cameras-module', name: 'Cameras' }),
		);
		expect(mutations.register).toHaveBeenCalledWith(CAMERAS_MODULE_NAME, expect.any(Function));
		expect(swagger.register).toHaveBeenCalledTimes(CAMERAS_SWAGGER_EXTRA_MODELS.length);
	});
});
