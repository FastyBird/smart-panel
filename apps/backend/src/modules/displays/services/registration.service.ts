import { validate } from 'class-validator';
import { CreateLongLiveTokenDto } from 'src/modules/auth/dto/create-token.dto';
import { LongLiveTokenEntity } from 'src/modules/auth/entities/auth.entity';
import { Repository } from 'typeorm';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { TokenOwnerType, TokenType } from '../../auth/auth.constants';
import { TokensService } from '../../auth/services/tokens.service';
import { hashToken } from '../../auth/utils/token.utils';
import { DISPLAYS_MODULE_NAME } from '../displays.constants';
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
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'RegistrationService');

	constructor(
		private readonly displaysService: DisplaysService,
		private readonly tokensService: TokensService,
		private readonly jwtService: JwtService,
		@InjectRepository(DisplayEntity)
		private readonly displayRepository: Repository<DisplayEntity>,
	) {}

	async registerDisplay(
		registerDto: RegisterDisplayDto,
		_userAgent: string,
		clientIp: string,
	): Promise<RegistrationResult> {
		const dtoInstance = await this.validateDto(RegisterDisplayDto, registerDto);

		// Check if display already exists by MAC address
		let display = await this.displaysService.findByMacAddress(dtoInstance.mac_address);

		if (display) {
			// Update existing display

			display = await this.displaysService.update(display.id, {
				version: dtoInstance.version,
				build: dtoInstance.build ?? null,
				screen_width: dtoInstance.screen_width,
				screen_height: dtoInstance.screen_height,
				pixel_ratio: dtoInstance.pixel_ratio,
				unit_size: dtoInstance.unit_size,
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

			display = await this.displaysService.create({
				macAddress: dtoInstance.mac_address,
				version: dtoInstance.version,
				build: dtoInstance.build ?? null,
				screenWidth: dtoInstance.screen_width ?? 0,
				screenHeight: dtoInstance.screen_height ?? 0,
				pixelRatio: dtoInstance.pixel_ratio ?? 1,
				unitSize: dtoInstance.unit_size ?? 8,
				rows: dtoInstance.rows ?? 12,
				cols: dtoInstance.cols ?? 24,
				audioOutputSupported: dtoInstance.audio_output_supported ?? false,
				audioInputSupported: dtoInstance.audio_input_supported ?? false,
				registeredFromIp: clientIp,
			});
		}

		// Generate long-lived token for the display
		const accessToken = await this.generateDisplayToken(display);

		return { display, accessToken };
	}

	async refreshDisplayToken(displayId: string, currentToken: string): Promise<TokenRefreshResult> {
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
			this.logger.warn(`Token not found for display=${displayId}`);
			throw new UnauthorizedException('Invalid token');
		}

		if (storedToken.revoked) {
			this.logger.warn(`Token is revoked for display=${displayId}`);
			throw new UnauthorizedException('Token has been revoked');
		}

		// Revoke the current token
		await this.tokensService.revokeByOwnerId(displayId, TokenOwnerType.DISPLAY);

		// Generate new token
		const newToken = await this.generateDisplayToken(display);

		// Get the expiration date
		const expiresAt = new Date();
		expiresAt.setFullYear(expiresAt.getFullYear() + 1);

		return { accessToken: newToken, expiresAt };
	}

	private async generateDisplayToken(display: DisplayEntity): Promise<string> {
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
			this.logger.error(`Validation failed: ${JSON.stringify(errors)}`);

			throw new DisplaysValidationException('Provided registration data is invalid.');
		}

		return dtoInstance;
	}
}
