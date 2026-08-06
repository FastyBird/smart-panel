/*
eslint-disable @typescript-eslint/no-unsafe-argument
*/
import request from 'supertest';

import { CanActivate, ExecutionContext, INestApplication, Injectable, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { TokenOwnerType } from '../src/modules/auth/auth.constants';
import { AuthenticatedEntity, AuthenticatedRequest } from '../src/modules/auth/guards/auth.guard';
import { ConfigController } from '../src/modules/config/controllers/config.controller';
import { UpdateModuleConfigDto } from '../src/modules/config/dto/config.dto';
import { ModuleConfigModel } from '../src/modules/config/models/config.model';
import { ConfigService } from '../src/modules/config/services/config.service';
import { ModulesTypeMapperService } from '../src/modules/config/services/modules-type-mapper.service';
import { PluginConfigValidatorService } from '../src/modules/config/services/plugin-config-validator.service';
import { PluginsTypeMapperService } from '../src/modules/config/services/plugins-type-mapper.service';
import { RolesGuard } from '../src/modules/users/guards/roles.guard';
import { UserRole } from '../src/modules/users/users.constants';

const TEST_CREDENTIALS: Record<string, AuthenticatedEntity> = {
	'owner-user': { type: 'user', id: 'owner-user', role: UserRole.OWNER },
	'admin-user': { type: 'user', id: 'admin-user', role: UserRole.ADMIN },
	'regular-user': { type: 'user', id: 'regular-user', role: UserRole.USER },
	'owner-pat': {
		type: 'token',
		tokenId: 'owner-pat',
		ownerType: TokenOwnerType.USER,
		ownerId: 'owner-user',
		role: UserRole.OWNER,
	},
	'admin-pat': {
		type: 'token',
		tokenId: 'admin-pat',
		ownerType: TokenOwnerType.USER,
		ownerId: 'admin-user',
		role: UserRole.ADMIN,
	},
	'user-pat': {
		type: 'token',
		tokenId: 'user-pat',
		ownerType: TokenOwnerType.USER,
		ownerId: 'regular-user',
		role: UserRole.USER,
	},
	'display-token': {
		type: 'token',
		tokenId: 'display-token',
		ownerType: TokenOwnerType.DISPLAY,
		ownerId: 'display-1',
		role: UserRole.USER,
	},
};

@Injectable()
class TestCredentialGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const credential = request.headers.authorization?.replace(/^Bearer /, '');
		const auth = credential ? TEST_CREDENTIALS[credential] : undefined;

		if (!auth) {
			throw new UnauthorizedException('Authentication required');
		}

		request.auth = auth;

		return true;
	}
}

describe('Module configuration authorization (e2e)', () => {
	let app: INestApplication;
	let configService: { getModuleConfig: jest.Mock; setModuleConfig: jest.Mock };

	beforeAll(async () => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue({ type: 'mock-module', enabled: false } as ModuleConfigModel),
			setModuleConfig: jest.fn(),
		};

		const moduleFixture = await Test.createTestingModule({
			controllers: [ConfigController],
			providers: [
				{ provide: APP_GUARD, useClass: TestCredentialGuard },
				{ provide: APP_GUARD, useClass: RolesGuard },
				{ provide: ConfigService, useValue: configService },
				{ provide: PluginsTypeMapperService, useValue: { getMapping: jest.fn() } },
				{
					provide: ModulesTypeMapperService,
					useValue: {
						getMapping: jest.fn().mockReturnValue({
							type: 'mock-module',
							class: ModuleConfigModel,
							configDto: UpdateModuleConfigDto,
						}),
					},
				},
				{
					provide: PluginConfigValidatorService,
					useValue: { validate: jest.fn(), hasValidator: jest.fn() },
				},
			],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		configService.setModuleConfig.mockClear();
	});

	it.each(['owner-user', 'admin-user', 'owner-pat', 'admin-pat'])(
		'allows module updates with %s credentials',
		async (credential) => {
			await request(app.getHttpServer())
				.patch('/config/module/mock-module')
				.set('Authorization', `Bearer ${credential}`)
				.send({ data: { type: 'mock-module', enabled: false } })
				.expect(200);

			expect(configService.setModuleConfig).toHaveBeenCalledTimes(1);
		},
	);

	it.each(['regular-user', 'user-pat', 'display-token'])(
		'denies module updates with %s credentials without mutating configuration',
		async (credential) => {
			await request(app.getHttpServer())
				.patch('/config/module/mock-module')
				.set('Authorization', `Bearer ${credential}`)
				.send({ data: { type: 'mock-module', enabled: false } })
				.expect(403);

			expect(configService.setModuleConfig).not.toHaveBeenCalled();
		},
	);
});
