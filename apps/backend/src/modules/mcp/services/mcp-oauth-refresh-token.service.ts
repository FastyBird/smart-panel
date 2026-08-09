import { randomBytes } from 'node:crypto';
import { DataSource, EntityManager, IsNull, MoreThan } from 'typeorm';

import { Injectable, UnauthorizedException } from '@nestjs/common';

import { hashToken } from '../../auth/utils/token.utils';
import {
	McpOAuthAccessTokenEntity,
	McpOAuthRefreshTokenEntity,
	McpOAuthRefreshTokenFamilyEntity,
} from '../entities/mcp-oauth.entity';

type RotationResult =
	| { status: 'rotated'; rawValue: string; artifact: McpOAuthRefreshTokenEntity }
	| { status: 'invalid' | 'reused' };

@Injectable()
export class McpOAuthRefreshTokenService {
	private rotationQueue: Promise<void> = Promise.resolve();

	constructor(private readonly dataSource: DataSource) {}

	async rotate(rawToken: string): Promise<{ rawValue: string; artifact: McpOAuthRefreshTokenEntity }> {
		let release: () => void;
		const previous = this.rotationQueue;
		this.rotationQueue = new Promise<void>((resolve) => {
			release = resolve;
		});
		await previous;

		try {
			return await this.rotateTransaction(rawToken);
		} finally {
			release();
		}
	}

	private async rotateTransaction(
		rawToken: string,
	): Promise<{ rawValue: string; artifact: McpOAuthRefreshTokenEntity }> {
		const result = await this.dataSource.transaction<RotationResult>(async (manager) => {
			const now = new Date();
			const tokenRepository = manager.getRepository(McpOAuthRefreshTokenEntity);
			const familyRepository = manager.getRepository(McpOAuthRefreshTokenFamilyEntity);
			const token = await tokenRepository.findOne({ where: { tokenHash: hashToken(rawToken) } });

			if (!token) {
				return { status: 'invalid' };
			}

			const family = await familyRepository.findOne({ where: { id: token.familyId } });

			if (!family || family.revokedAt || family.expiresAt <= now || token.revokedAt || token.expiresAt <= now) {
				return { status: 'invalid' };
			}

			const consumed = await tokenRepository.update(
				{
					id: token.id,
					consumedAt: IsNull(),
					revokedAt: IsNull(),
					expiresAt: MoreThan(now),
				},
				{ consumedAt: now },
			);

			if (!consumed.affected) {
				await this.revokeFamily(manager, family.id, now, 'refresh_token_reuse');
				return { status: 'reused' };
			}

			const rawValue = randomBytes(32).toString('base64url');
			const artifact = await tokenRepository.save(
				tokenRepository.create({
					tokenHash: hashToken(rawValue),
					familyId: family.id,
					predecessorId: token.id,
					expiresAt: family.expiresAt,
					consumedAt: null,
					revokedAt: null,
				}),
			);

			return { status: 'rotated', rawValue, artifact };
		});

		if (result.status !== 'rotated') {
			throw new UnauthorizedException(
				result.status === 'reused' ? 'Refresh token reuse revoked the token family' : 'Invalid refresh token',
			);
		}

		return result;
	}

	private async revokeFamily(manager: EntityManager, familyId: string, revokedAt: Date, reason: string): Promise<void> {
		await manager
			.getRepository(McpOAuthRefreshTokenFamilyEntity)
			.update({ id: familyId }, { revokedAt, revocationReason: reason, generation: () => 'generation + 1' });
		await manager.getRepository(McpOAuthRefreshTokenEntity).update({ familyId, revokedAt: IsNull() }, { revokedAt });
		await manager
			.getRepository(McpOAuthAccessTokenEntity)
			.update({ refreshFamilyId: familyId, revokedAt: IsNull() }, { revokedAt });
	}
}
