import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { UserEntity } from '../../users/entities/users.entity';
import { TokenOwnerType } from '../auth.constants';
import { AccessTokenEntity, LongLiveTokenEntity, RefreshTokenEntity, TokenEntity } from '../entities/auth.entity';
import { hashToken } from '../utils/token.utils';

import { TokenMetadataService } from './token-metadata.service';
import { TokenUsageService } from './token-usage.service';
import { TokensService } from './tokens.service';

describe('Token usage with real SQLite inheritance', () => {
	let database: DataSource;
	let usage: TokenUsageService;
	let tokens: TokensService;
	let token: LongLiveTokenEntity;
	const observedAt = new Date('2026-10-02T10:00:00.123Z');

	beforeEach(async () => {
		database = await new DataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [UserEntity, TokenEntity, AccessTokenEntity, RefreshTokenEntity, LongLiveTokenEntity],
		}).initialize();
		usage = new TokenUsageService(database);
		tokens = new TokensService(
			database.getRepository(TokenEntity),
			null as never,
			database,
			usage,
			new TokenMetadataService(database),
		);
		const id = uuid();
		await database
			.createQueryBuilder()
			.insert()
			.into(LongLiveTokenEntity)
			.values({ id, hashedToken: hashToken('presented-token'), name: 'test', ownerType: TokenOwnerType.DISPLAY })
			.callListeners(false)
			.execute();
		token = await database.getRepository(LongLiveTokenEntity).findOneByOrFail({ id });
		jest.spyOn(Date, 'now').mockReturnValue(observedAt.getTime());
	});

	afterEach(async () => {
		await usage?.beforeApplicationShutdown();
		jest.restoreAllMocks();
		if (database?.isInitialized) await database.destroy();
	});

	it('performs zero SQL through the request-facing service and one conditional UPDATE for 100 observations', async () => {
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		for (let i = 0; i < 100; i++) tokens.recordUsage(token);
		expect(query).not.toHaveBeenCalled();
		await usage.flush();
		expect(query).toHaveBeenCalledTimes(1);
		expect(query.mock.calls[0][0]).toMatch(/^UPDATE /);
		const stored = await database.getRepository(LongLiveTokenEntity).findOneByOrFail({ id: token.id });
		expect(stored.lastUsedAt).toEqual(observedAt);
	});

	it.each(['rotate', 'delete', 'replace', 'revoke'] as const)(
		'does not apply pending usage after credential lifecycle change: %s',
		async (change) => {
			tokens.recordUsage(token);
			const repository = database.getRepository(LongLiveTokenEntity);
			if (change === 'revoke') await repository.update(token.id, { revoked: true });
			if (change === 'rotate') await repository.update(token.id, { hashedToken: hashToken('new-token') });
			if (change === 'delete' || change === 'replace') await repository.delete(token.id);
			if (change === 'replace') {
				await database
					.createQueryBuilder()
					.insert()
					.into(LongLiveTokenEntity)
					.values({ id: token.id, hashedToken: hashToken('replacement'), name: 'new', ownerType: TokenOwnerType.USER })
					.callListeners(false)
					.execute();
			}
			await usage.flush();
			const stored = await repository.findOneBy({ id: token.id });
			if (change === 'delete') expect(stored).toBeNull();
			else expect(stored?.lastUsedAt).toBeNull();
		},
	);

	it('advances an older persisted timestamp but never overwrites a newer timestamp', async () => {
		const repository = database.getRepository(LongLiveTokenEntity);
		await repository.update(token.id, { lastUsedAt: new Date(observedAt.getTime() - 1) });
		tokens.recordUsage(token);
		await usage.flush();
		expect((await repository.findOneByOrFail({ id: token.id })).lastUsedAt).toEqual(observedAt);
		const newer = new Date(observedAt.getTime() + 1);
		await repository.update(token.id, { lastUsedAt: newer });
		tokens.recordUsage(token);
		await usage.flush();
		expect((await repository.findOneByOrFail({ id: token.id })).lastUsedAt).toEqual(newer);
	});

	it('cannot update another token subtype with the same ID and hash', async () => {
		tokens.recordUsage(token);
		await database.getRepository(LongLiveTokenEntity).delete(token.id);
		await database
			.createQueryBuilder()
			.insert()
			.into(AccessTokenEntity)
			.values({ id: token.id, hashedToken: token.hashedToken })
			.callListeners(false)
			.execute();
		await usage.flush();
		const rows: { lastUsedAt: string | null }[] = await database.query(
			'SELECT lastUsedAt FROM auth_module_tokens WHERE id = ?',
			[token.id],
		);
		expect(rows[0].lastUsedAt).toBeNull();
	});
});
