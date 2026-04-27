import crypto from 'crypto';

import { CacheModule } from '@nestjs/cache-manager';
import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DEFAULT_TOKEN_EXPIRATION, DEFAULT_TOKEN_SECRET } from '../../app.constants';
import { getEnvValue } from '../../common/utils/config.utils';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { UsersModule } from '../users/users.module';

import {
	AUTH_MODULE_API_TAG_DESCRIPTION,
	AUTH_MODULE_API_TAG_NAME,
	AUTH_MODULE_NAME,
	TokenType,
} from './auth.constants';
import { AUTH_SWAGGER_EXTRA_MODELS } from './auth.openapi';
import { RegisterOwnerCommand } from './commands/register-owner.command';
import { ResetPasswordCommand } from './commands/reset-password.command';
import { AuthController } from './controllers/auth.controller';
import { TokensController } from './controllers/tokens.controller';
import { CreateAccessTokenDto, CreateLongLiveTokenDto, CreateRefreshTokenDto } from './dto/create-token.dto';
import { UpdateAuthConfigDto } from './dto/update-config.dto';
import { UpdateAccessTokenDto, UpdateLongLiveTokenDto, UpdateRefreshTokenDto } from './dto/update-token.dto';
import { AccessTokenEntity, LongLiveTokenEntity, RefreshTokenEntity, TokenEntity } from './entities/auth.entity';
import { AuthConfigModel } from './models/config.model';
import { AuthService } from './services/auth.service';
import { CryptoService } from './services/crypto.service';
import { TokensTypeMapperService } from './services/tokens-type-mapper.service';
import { TokensService } from './services/tokens.service';

@ApiTag({
	tagName: AUTH_MODULE_NAME,
	displayName: AUTH_MODULE_API_TAG_NAME,
	description: AUTH_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		JwtModule.registerAsync({
			imports: [NestConfigModule],
			inject: [NestConfigService],
			useFactory: (configService: NestConfigService) => {
				const logger = new Logger('AuthModule');

				let secret = getEnvValue<string | undefined>(configService, 'FB_TOKEN_SECRET', DEFAULT_TOKEN_SECRET);

				if (!secret || secret === DEFAULT_TOKEN_SECRET) {
					const nodeEnv = configService.get<string>('NODE_ENV');

					if (nodeEnv === 'production') {
						logger.error(
							'CRITICAL: No FB_TOKEN_SECRET configured in production! ' +
								'Auto-generating a random secret. Sessions will NOT persist across restarts. ' +
								'Set the FB_TOKEN_SECRET environment variable to fix this.',
						);
					}

					secret = crypto.randomBytes(32).toString('base64');

					logger.warn(
						'No FB_TOKEN_SECRET configured — using auto-generated secret. Sessions will not persist across restarts.',
					);
				}

				return {
					secret,
					signOptions: { expiresIn: DEFAULT_TOKEN_EXPIRATION },
				};
			},
		}),
		NestConfigModule,
		TypeOrmModule.forFeature([TokenEntity, AccessTokenEntity, RefreshTokenEntity, LongLiveTokenEntity]),
		CacheModule.register(),
		SwaggerModule,
		UsersModule,
	],
	providers: [
		AuthService,
		TokensService,
		CryptoService,
		TokensTypeMapperService,
		RegisterOwnerCommand,
		ResetPasswordCommand,
	],
	controllers: [AuthController, TokensController],
	// `AuthGuard` and `DisplayAwareThrottlerGuard` are intentionally NOT
	// registered here as `APP_GUARD` providers — they live in `AppModule`
	// instead. See the comment in `app.module.ts` next to the providers
	// list for why ordering between them must be controlled at one place.
	exports: [AuthService, TokensService, CryptoService, TokensTypeMapperService, JwtModule],
})
export class AuthModule implements OnModuleInit {
	constructor(
		private readonly mapper: TokensTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.mapper.registerMapping<AccessTokenEntity, CreateAccessTokenDto, UpdateAccessTokenDto>({
			type: TokenType.ACCESS,
			class: AccessTokenEntity,
			createDto: CreateAccessTokenDto,
			updateDto: UpdateAccessTokenDto,
		});

		this.mapper.registerMapping<RefreshTokenEntity, CreateRefreshTokenDto, UpdateRefreshTokenDto>({
			type: TokenType.REFRESH,
			class: RefreshTokenEntity,
			createDto: CreateRefreshTokenDto,
			updateDto: UpdateRefreshTokenDto,
		});

		this.mapper.registerMapping<LongLiveTokenEntity, CreateLongLiveTokenDto, UpdateLongLiveTokenDto>({
			type: TokenType.LONG_LIVE,
			class: LongLiveTokenEntity,
			createDto: CreateLongLiveTokenDto,
			updateDto: UpdateLongLiveTokenDto,
		});

		for (const model of AUTH_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register module config mapping
		this.modulesMapperService.registerMapping<AuthConfigModel, UpdateAuthConfigDto>({
			type: AUTH_MODULE_NAME,
			class: AuthConfigModel,
			configDto: UpdateAuthConfigDto,
		});

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: AUTH_MODULE_NAME,
			name: 'Sign‑in & Security',
			description: 'Authentication and token management',
			author: 'FastyBird',
			readme: `# Sign-in & Security

> Module · by FastyBird

Handles user authentication, JWT issuing and session management for the Smart Panel backend, admin UI and panel display. Owns the full token lifecycle — login, refresh, logout, profile, password reset and personal access tokens — plus per-display registration credentials issued during pairing.

## Features

- **JWT authentication** — signed access tokens with configurable expiration; rotated automatically on every \`/auth/refresh\`
- **Refresh tokens** — long-lived tokens stored hashed in the database; used to silently renew access tokens without prompting the user
- **Long-live (personal) tokens** — non-expiring tokens for automation, scripts and external integrations, individually revocable from the admin UI or the API
- **Display registration tokens** — short-lived credentials issued during display pairing so a panel can authenticate without a user account
- **Password security** — bcrypt hashing with per-user salt; passwords never returned in any response
- **Username / email availability** — public endpoints used by the registration form to validate inputs before submit
- **Owner bootstrap** — first-run CLI wizard creates the owner account; subsequent owners must be added through the admin UI
- **Hardening** — guard chain refuses requests when the JWT secret is auto-generated in production and surfaces a critical log line until an explicit \`FB_TOKEN_SECRET\` is provided

## API Endpoints

- \`POST /api/v1/modules/auth/login\` — exchange username + password for an access / refresh token pair
- \`POST /api/v1/modules/auth/register\` — register a new user (subject to module configuration)
- \`POST /api/v1/modules/auth/refresh\` — issue a fresh access token from a refresh token
- \`POST /api/v1/modules/auth/check/username\` / \`check/email\` — availability lookups for the sign-up form
- \`GET /api/v1/modules/auth/profile\` — return the authenticated user's profile
- \`GET|POST|PATCH|DELETE /api/v1/modules/auth/tokens\` — list, create, edit and revoke long-live tokens
- \`POST /api/v1/modules/auth/tokens/personal\` — quick-create flow for a personal token

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`FB_TOKEN_SECRET\` | Secret used to sign JWTs (env var, **set this in production**) | auto-generated random |
| \`token_expiration\` | Lifetime of access tokens | \`1h\` |

## CLI Commands

- \`pnpm run cli auth:onboarding\` — create the initial owner account
- \`pnpm run cli auth:reset\` — reset the owner password`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
