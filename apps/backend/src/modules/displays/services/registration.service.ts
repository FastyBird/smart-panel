import { validate } from 'class-validator';
import { CreateLongLiveTokenDto } from 'src/modules/auth/dto/create-token.dto';
import { LongLiveTokenEntity } from 'src/modules/auth/entities/auth.entity';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { TokenOwnerType, TokenType } from '../../auth/auth.constants';
import { TokensService } from '../../auth/services/tokens.service';
import { hashToken } from '../../auth/utils/token.utils';
import { DisplaysValidationException } from '../displays.exceptions';
import { RegisterDisplayDto } from '../dto/register-display.dto';
import { DisplayEntity } from '../entities/displays.entity';

import { DisplaysService } from './displays.service';

export interface RegistrationResult {
	display: DisplayEntity;
	accessToken: string;
}

export interface TokenRefreshResult {
	accessToken: string;
	expiresAt: Date;
}

@Injectable()
export class RegistrationService {
	private readonly logger = new Logger(RegistrationService.name);

	constructor(
		private readonly displaysService: DisplaysService,
		private readonly tokensService: TokensService,
		private readonly jwtService: JwtService,
		@InjectRepository(DisplayEntity)
		private readonly displayRepository: Repository<DisplayEntity>,
	) {}

	async registerDisplay(registerDto: RegisterDisplayDto, _userAgent: string, clientIp: string): Promise<RegistrationResult> {
		this.logger.debug(`[REGISTER] Registering display with MAC=${registerDto.macAddress}, IP=${clientIp}`);

		const dtoInstance = await this.validateDto(RegisterDisplayDto, registerDto);

		// Check if display already exists by MAC address
		let display = await this.displaysService.findByMacAddress(dtoInstance.macAddress);

		if (display) {
			// Update existing display
			this.logger.debug(`[REGISTER] Display already exists, updating`);

			display = await this.displaysService.update(display.id, {
				version: dtoInstance.version,
				build: dtoInstance.build ?? null,
				screenWidth: dtoInstance.screenWidth,
				screenHeight: dtoInstance.screenHeight,
				pixelRatio: dtoInstance.pixelRatio,
				unitSize: dtoInstance.unitSize,
				rows: dtoInstance.rows,
				cols: dtoInstance.cols,
			});

			// Update registeredFromIp directly on the entity (not via DTO)
			display.registeredFromIp = clientIp;
			display = await this.displayRepository.save(display);

			// Revoke existing tokens for this display
			await this.tokensService.revokeByOwnerId(display.id, TokenOwnerType.DISPLAY);
		} else {
			// Create new display
			this.logger.debug(`[REGISTER] Creating new display`);

			display = await this.displaysService.create({
				macAddress: dtoInstance.macAddress,
				version: dtoInstance.version,
				build: dtoInstance.build ?? null,
				screenWidth: dtoInstance.screenWidth ?? 0,
				screenHeight: dtoInstance.screenHeight ?? 0,
				pixelRatio: dtoInstance.pixelRatio ?? 1,
				unitSize: dtoInstance.unitSize ?? 8,
				rows: dtoInstance.rows ?? 12,
				cols: dtoInstance.cols ?? 24,
				audioOutputSupported: dtoInstance.audioOutputSupported ?? false,
				audioInputSupported: dtoInstance.audioInputSupported ?? false,
				registeredFromIp: clientIp,
			});
		}

		// Generate long-lived token for the display
		const accessToken = await this.generateDisplayToken(display);

		this.logger.debug(`[REGISTER] Successfully registered display with id=${display.id}`);

		return { display, accessToken };
	}

	async refreshDisplayToken(displayId: string, currentToken: string): Promise<TokenRefreshResult> {
		this.logger.debug(`[REFRESH] Refreshing token for display=${displayId}`);

		// Verify the display exists
		const display = await this.displaysService.getOneOrThrow(displayId);

		// Find and validate the current token
		const displayTokens = await this.tokensService.findByOwnerId(displayId, TokenOwnerType.DISPLAY);

		let storedToken: LongLiveTokenEntity | null = null;

		for (const token of displayTokens) {
			if (hashToken(currentToken) === token.hashedToken) {
				storedToken = token;
				break;
			}
		}

		if (!storedToken) {
			this.logger.warn(`[REFRESH] Token not found for display=${displayId}`);
			throw new UnauthorizedException('Invalid token');
		}

		if (storedToken.revoked) {
			this.logger.warn(`[REFRESH] Token is revoked for display=${displayId}`);
			throw new UnauthorizedException('Token has been revoked');
		}

		// Revoke the current token
		await this.tokensService.revokeByOwnerId(displayId, TokenOwnerType.DISPLAY);

		// Generate new token
		const newToken = await this.generateDisplayToken(display);

		// Get the expiration date
		const expiresAt = new Date();
		expiresAt.setFullYear(expiresAt.getFullYear() + 1);

		this.logger.debug(`[REFRESH] Successfully refreshed token for display=${displayId}`);

		return { accessToken: newToken, expiresAt };
	}

	private async generateDisplayToken(display: DisplayEntity): Promise<string> {
		this.logger.debug(`[TOKEN] Generating token for display=${display.id}`);

		// Calculate expiration date (1 year from now)
		const expiresAt = new Date();
		expiresAt.setFullYear(expiresAt.getFullYear() + 1);

		// Generate JWT token with display info
		const token = this.jwtService.sign(
			{
				sub: display.id,
				type: TokenOwnerType.DISPLAY,
				mac: display.macAddress,
			},
			{
				expiresIn: '365d', // Long-lived token (1 year)
			},
		);

		// Store token in database
		await this.tokensService.create<LongLiveTokenEntity, CreateLongLiveTokenDto>({
			type: TokenType.LONG_LIVE,
			token: token,
			ownerType: TokenOwnerType.DISPLAY,
			ownerId: display.id,
			name: `Display Token - ${display.macAddress}`,
			description: `Auto-generated token for display ${display.name ?? display.macAddress}`,
			expiresAt: expiresAt,
		});

		this.logger.debug(`[TOKEN] Successfully generated token for display=${display.id}`);

		return token;
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: any): Promise<T> {
		const dtoInstance = toInstance(DtoClass, dto, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new DisplaysValidationException('Provided registration data is invalid.');
		}

		return dtoInstance;
	}
}
