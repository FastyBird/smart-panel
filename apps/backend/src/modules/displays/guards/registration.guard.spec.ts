import { FastifyRequest } from 'fastify';

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ClientAddressService } from '../../api/services/client-address.service';
import { TrustedProxyRegistryService } from '../../api/services/trusted-proxy-registry.service';
import { TokensService } from '../../auth/services/tokens.service';
import { ConfigService } from '../../config/services/config.service';
import { DISPLAYS_MODULE_NAME, DeploymentMode } from '../displays.constants';
import { DisplaysConfigModel } from '../models/config.model';
import { DisplaysService } from '../services/displays.service';
import { PermitJoinService } from '../services/permit-join.service';

import { RegistrationGuard } from './registration.guard';

function fastifyRequest(headers: Record<string, string>, remoteAddress: string): FastifyRequest {
	return {
		headers,
		raw: { socket: { remoteAddress } },
	} as unknown as FastifyRequest;
}

function contextFor(request: FastifyRequest): ExecutionContext {
	return {
		switchToHttp: () => ({
			getRequest: () => request,
			getResponse: () => ({}),
			getNext: () => ({}),
		}),
	} as unknown as ExecutionContext;
}

function buildConfig(mode: DeploymentMode = DeploymentMode.COMBINED): DisplaysConfigModel {
	const config = new DisplaysConfigModel();
	config.type = DISPLAYS_MODULE_NAME;
	config.deploymentMode = mode;
	config.permitJoinDurationMs = 120000;

	return config;
}

describe('RegistrationGuard', () => {
	let guard: RegistrationGuard;
	let trustedProxyRegistry: TrustedProxyRegistryService;
	let permitJoinService: { isPermitJoinActive: jest.Mock };
	let configService: { getModuleConfig: jest.Mock };

	beforeEach(async () => {
		permitJoinService = { isPermitJoinActive: jest.fn().mockReturnValue(false) };
		configService = { getModuleConfig: jest.fn().mockReturnValue(buildConfig()) };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				RegistrationGuard,
				{ provide: ConfigService, useValue: configService },
				{ provide: PermitJoinService, useValue: permitJoinService },
				{ provide: DisplaysService, useValue: {} },
				{ provide: TokensService, useValue: {} },
				TrustedProxyRegistryService,
				ClientAddressService,
			],
		}).compile();

		guard = module.get<RegistrationGuard>(RegistrationGuard);
		trustedProxyRegistry = module.get<TrustedProxyRegistryService>(TrustedProxyRegistryService);
	});

	it('rejects a spoofed loopback address from an untrusted LAN peer without permit-join', () => {
		// The socket peer is a real LAN host — not localhost, not a trusted
		// proxy — so its claimed `X-Forwarded-For: 127.0.0.1` must be ignored
		// entirely rather than bypassing permit-join.
		const request = fastifyRequest({ 'x-forwarded-for': '127.0.0.1' }, '192.168.1.50');

		expect(() => guard.canActivate(contextFor(request))).toThrow(ForbiddenException);
		expect(permitJoinService.isPermitJoinActive).toHaveBeenCalled();
	});

	it('accepts a genuine loopback peer regardless of permit-join state', () => {
		const request = fastifyRequest({}, '127.0.0.1');

		expect(guard.canActivate(contextFor(request))).toBe(true);
	});

	it('treats a LAN client forwarded through a trusted loopback proxy as that client', () => {
		trustedProxyRegistry.register({ id: 'remote-access', addresses: () => ['127.0.0.1'] });
		const request = fastifyRequest({ 'x-forwarded-for': '192.168.1.77' }, '127.0.0.1');

		// Not auto-accepted as localhost: the resolved client is a real LAN
		// address behind a trusted proxy, so it is subject to the normal
		// permit-join gate rather than the loopback bypass.
		expect(() => guard.canActivate(contextFor(request))).toThrow(ForbiddenException);

		permitJoinService.isPermitJoinActive.mockReturnValue(true);

		expect(guard.canActivate(contextFor(request))).toBe(true);
	});

	it('rejects any non-localhost peer in all-in-one mode even with permit-join active', () => {
		configService.getModuleConfig.mockReturnValue(buildConfig(DeploymentMode.ALL_IN_ONE));
		permitJoinService.isPermitJoinActive.mockReturnValue(true);
		const request = fastifyRequest({}, '192.168.1.50');

		expect(() => guard.canActivate(contextFor(request))).toThrow(ForbiddenException);
	});
});
