import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { getEnvValue } from '../../common/utils/config.utils';
import { UsersModule } from '../users/users.module';

import { TokenType } from './auth.constants';
import { ResetPasswordCommand } from './commands/reset-password.command';
import { AuthController } from './controllers/auth.controller';
import { TokensController } from './controllers/tokens.controller';
import { CreateAccessTokenDto, CreateLongLiveTokenDto, CreateRefreshTokenDto } from './dto/create-token.dto';
import { UpdateAccessTokenDto, UpdateLongLiveTokenDto, UpdateRefreshTokenDto } from './dto/update-token.dto';
import { AccessTokenEntity, LongLiveTokenEntity, RefreshTokenEntity, TokenEntity } from './entities/auth.entity';
import { AuthGuard } from './guards/auth.guard';
import { AuthService } from './services/auth.service';
import { CryptoService } from './services/crypto.service';
import { TokensTypeMapperService } from './services/tokens-type-mapper.service';
import { TokensService } from './services/tokens.service';

@Module({
	imports: [
		NestConfigModule,
		UsersModule,
		TypeOrmModule.forFeature([TokenEntity, AccessTokenEntity, RefreshTokenEntity, LongLiveTokenEntity]),
		JwtModule.registerAsync({
			imports: [NestConfigModule],
			inject: [NestConfigService],
			useFactory: (configService: NestConfigService) => ({
				secret: getEnvValue<string | undefined>(
					configService,
					'TOKEN_SECRET',
					'g3xHbkELpMD9LRqW4WmJkHL7kz2bdNYAQJyEuFVzR3k=',
				),
				signOptions: { expiresIn: '1h' },
			}),
		}),
	],
	providers: [
		AuthService,
		TokensService,
		CryptoService,
		TokensTypeMapperService,
		ResetPasswordCommand,
		{
			provide: APP_GUARD,
			useClass: AuthGuard,
		},
	],
	controllers: [AuthController, TokensController],
	exports: [AuthService, TokensService, CryptoService, TokensTypeMapperService],
})
export class AuthModule {
	constructor(private readonly mapper: TokensTypeMapperService) {}

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
	}
}
