import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { UserEntity } from '../../users/entities/users.entity';
import { AuthException } from '../auth.exceptions';
import { AccessTokenEntity, LongLiveTokenEntity, RefreshTokenEntity, TokenEntity } from '../entities/auth.entity';
import { hashToken } from '../utils/token.utils';

import { TokenMetadataService } from './token-metadata.service';
import { TokenUsageService } from './token-usage.service';
import { TokensService } from './tokens.service';

describe('Access token lookup with real SQLite inheritance and relations', () => {
	let database: DataSource;
	let service: TokensService;
	let owner: UserEntity;
	let accessId: string;
	let refreshId: string;
	const presentedHash = hashToken('presented-access-token');

	beforeEach(async () => {
		database = await new DataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [UserEntity, TokenEntity, AccessTokenEntity, RefreshTokenEntity, LongLiveTokenEntity],
		}).initialize();
		service = new TokensService(
			database.getRepository(TokenEntity),
			null as never,
			database,
			new TokenUsageService(database),
			new TokenMetadataService(database),
		);
		owner = await database.getRepository(UserEntity).save({ username: 'test-owner' });
		accessId = uuid();
		refreshId = uuid();
		// Insert precomputed hashes without running the production plaintext-token insert listener.
		await database
			.createQueryBuilder()
			.insert()
			.into(AccessTokenEntity)
			.values({
				id: accessId,
				ownerId: owner.id,
				hashedToken: presentedHash,
			})
			.callListeners(false)
			.execute();
		await database
			.createQueryBuilder()
			.insert()
			.into(RefreshTokenEntity)
			.values({
				id: refreshId,
				ownerId: owner.id,
				parentId: accessId,
				hashedToken: hashToken('refresh-token'),
			})
			.callListeners(false)
			.execute();
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		if (database?.isInitialized) await database.destroy();
	});

	it('loads the same access/refresh graph while returning one row among 805 owner credentials', async () => {
		for (let offset = 0; offset < 804; offset += 100) {
			await database
				.createQueryBuilder()
				.insert()
				.into(AccessTokenEntity)
				.values(
					Array.from({ length: Math.min(100, 804 - offset) }, (_, i) => ({
						id: uuid(),
						ownerId: owner.id,
						hashedToken: hashToken(`unrelated-${offset + i}`),
					})),
				)
				.callListeners(false)
				.execute();
		}
		const previous = await service.findAllByOwner(owner.id, AccessTokenEntity);
		expect(previous).toHaveLength(805);
		const runner = database.createQueryRunner();
		const query = jest.spyOn(runner, 'query');
		const actual = await service.findAccessTokenByOwnerAndHash(owner.id, presentedHash);
		expect(actual).toEqual(previous.find((token) => token.id === accessId));
		expect(actual).toBeInstanceOf(AccessTokenEntity);
		expect(actual?.refreshToken).toBeInstanceOf(RefreshTokenEntity);
		expect(actual?.refreshToken.id).toBe(refreshId);
		expect(query).toHaveBeenCalledTimes(1);
		const [sql, parameters] = query.mock.calls[0];
		const rows: unknown[] = await database.query(sql, parameters);
		expect(rows).toHaveLength(1);
	});

	it('requires both the owner and presented hash and excludes other token subtypes', async () => {
		const other = await database.getRepository(UserEntity).save({ username: 'other-owner' });
		expect(await service.findAccessTokenByOwnerAndHash(other.id, presentedHash)).toBeNull();
		expect(await service.findAccessTokenByOwnerAndHash(owner.id, hashToken('unknown'))).toBeNull();
		expect(await service.findAccessTokenByOwnerAndHash(owner.id, hashToken('refresh-token'))).toBeNull();
		await database
			.createQueryBuilder()
			.insert()
			.into(LongLiveTokenEntity)
			.values({
				id: uuid(),
				tokenOwnerId: owner.id,
				hashedToken: hashToken('long-live'),
				name: 'test',
			})
			.callListeners(false)
			.execute();
		expect(await service.findAccessTokenByOwnerAndHash(owner.id, hashToken('long-live'))).toBeNull();
	});

	it('rereads revocation and deletion rather than caching credentials', async () => {
		expect((await service.findAccessTokenByOwnerAndHash(owner.id, presentedHash))?.revoked).toBe(false);
		await database.getRepository(AccessTokenEntity).update(accessId, { revoked: true });
		await database.getRepository(RefreshTokenEntity).update(refreshId, { revoked: true });
		const revoked = await service.findAccessTokenByOwnerAndHash(owner.id, presentedHash);
		expect(revoked?.revoked).toBe(true);
		expect(revoked?.refreshToken.revoked).toBe(true);
		await database.getRepository(AccessTokenEntity).delete(accessId);
		expect(await service.findAccessTokenByOwnerAndHash(owner.id, presentedHash)).toBeNull();
	});

	it.each(['missing', 'multiple'])('preserves the %s refresh-child rejection', async (condition) => {
		if (condition === 'missing') {
			await database.getRepository(RefreshTokenEntity).delete(refreshId);
		} else {
			await database
				.createQueryBuilder()
				.insert()
				.into(RefreshTokenEntity)
				.values({
					id: uuid(),
					ownerId: owner.id,
					parentId: accessId,
					hashedToken: hashToken('second-refresh'),
				})
				.callListeners(false)
				.execute();
		}
		const result = await service.findAccessTokenByOwnerAndHash(owner.id, presentedHash);
		expect(result).not.toBeNull();
		expect(() => result.refreshToken).toThrow(AuthException);
	});

	it('propagates database failures', async () => {
		jest.spyOn(database.createQueryRunner(), 'query').mockRejectedValueOnce(new Error('SQLite unavailable'));
		await expect(service.findAccessTokenByOwnerAndHash(owner.id, presentedHash)).rejects.toThrow('SQLite unavailable');
	});
});
