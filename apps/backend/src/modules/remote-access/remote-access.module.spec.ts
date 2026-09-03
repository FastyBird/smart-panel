import { UpdateRemoteAccessConfigDto } from './dto/update-config.dto';
import { RemoteAccessConfigModel } from './models/config.model';
import { REMOTE_ACCESS_MODULE_NAME } from './remote-access.constants';
import { RemoteAccessModule } from './remote-access.module';
import { REMOTE_ACCESS_SWAGGER_EXTRA_MODELS } from './remote-access.openapi';
import { RemoteAccessProxyContributionService } from './services/remote-access-proxy-contribution.service';

describe('RemoteAccessModule bootstrap', () => {
	it('registers the config mapping, every Swagger model and extension metadata during module initialization', () => {
		const registerMapping = jest.fn();
		const swaggerRegister = jest.fn();
		const registerModuleMetadata = jest.fn();

		const module = new RemoteAccessModule(
			{ register: swaggerRegister } as never,
			{ registerMapping } as never,
			{ registerModuleMetadata } as never,
		);

		module.onModuleInit();

		expect(registerMapping).toHaveBeenCalledWith({
			type: REMOTE_ACCESS_MODULE_NAME,
			class: RemoteAccessConfigModel,
			configDto: UpdateRemoteAccessConfigDto,
		});

		expect(swaggerRegister).toHaveBeenCalledTimes(REMOTE_ACCESS_SWAGGER_EXTRA_MODELS.length);

		for (const model of REMOTE_ACCESS_SWAGGER_EXTRA_MODELS) {
			expect(swaggerRegister).toHaveBeenCalledWith(model);
		}

		expect(registerModuleMetadata).toHaveBeenCalledWith(
			expect.objectContaining({ type: REMOTE_ACCESS_MODULE_NAME, name: 'Remote access' }),
		);
	});
});

describe('RemoteAccessProxyContributionService bootstrap', () => {
	// The full behaviour matrix (config-gated proxies, connected-provider
	// addresses, live re-read without re-registering) lives in
	// remote-access-proxy-contribution.service.spec.ts. This is just
	// bootstrap-wiring smoke coverage alongside RemoteAccessModule's own
	// onModuleInit above: the trusted-proxy source is registered by this
	// module's *other* OnModuleInit provider, not by RemoteAccessModule
	// itself.
	it('registers a trusted-proxy source under the module name during module initialization', () => {
		const register = jest.fn();

		const service = new RemoteAccessProxyContributionService(
			{ register } as never,
			{ getModuleConfig: jest.fn().mockReturnValue({ trustForwardedHeaders: false, trustedProxies: [] }) } as never,
			{ getCachedStatuses: jest.fn().mockReturnValue([]) } as never,
		);

		service.onModuleInit();

		expect(register).toHaveBeenCalledWith(expect.objectContaining({ id: REMOTE_ACCESS_MODULE_NAME }));
	});
});
