import { DataSource, UpdateEvent } from 'typeorm';

import { ConfigService } from '@nestjs/config';

import { TokenOwnerType } from '../auth.constants';
import { LongLiveTokenEntity, TokenEntity } from '../entities/auth.entity';

import { TokenMetadataService, tokenMetadataCapacity } from './token-metadata.service';

describe('Bounded runtime token metadata', () => {
	let service: TokenMetadataService;
	let query: jest.Mock;
	let database: DataSource;
	let row: LongLiveTokenEntity;

	beforeEach(() => {
		row = Object.assign(new LongLiveTokenEntity(), {
			id: 'token',
			hashedToken: 'hash',
			ownerType: TokenOwnerType.DISPLAY,
			tokenOwnerId: 'display',
			revoked: false,
			expiresAt: new Date(Date.now() + 60_000),
		});
		query = jest.fn().mockResolvedValue(row);
		database = { subscribers: [], getRepository: () => ({ findOne: query }) } as unknown as DataSource;
		service = new TokenMetadataService(database, new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }));
	});
	afterEach(() => service.onModuleDestroy());

	it('coalesces cold reads and detaches facts including expiry dates', async () => {
		const [first, second] = await Promise.all([service.findByHash('hash'), service.findByHash('hash')]);
		expect(query).toHaveBeenCalledTimes(1);
		first.revoked = true;
		first.expiresAt.setFullYear(1990);
		expect(second.revoked).toBe(false);
		expect(second.expiresAt.getTime()).toBe(row.expiresAt.getTime());
		expect((await service.findByHash('hash')).revoked).toBe(false);
	});

	it('discards an in-flight grant after revocation and does not retain rejected facts', async () => {
		let finish!: (row: LongLiveTokenEntity) => void;
		query.mockImplementationOnce(() => new Promise<LongLiveTokenEntity>((resolve) => (finish = resolve)));
		const pending = service.findByHash('hash');
		service.beforeUpdate({
			metadata: { inheritanceTree: [TokenEntity, LongLiveTokenEntity] },
			entity: { revoked: true },
			queryRunner: { isTransactionActive: false },
		} as unknown as UpdateEvent<LongLiveTokenEntity>);
		query.mockResolvedValue({ ...row, revoked: true });
		finish(row);
		expect((await pending).revoked).toBe(true);
		expect((await service.findByHash('hash')).revoked).toBe(true);
		expect(query).toHaveBeenCalledTimes(3);
	});

	it('does not let an obsolete rejected read remove a newer coalesced lookup', async () => {
		let rejectOld!: (error: Error) => void;
		let finishNew!: (row: LongLiveTokenEntity) => void;
		query
			.mockImplementationOnce(() => new Promise((_, reject) => (rejectOld = reject)))
			.mockImplementationOnce(() => new Promise((resolve) => (finishNew = resolve)));
		const old = expect(service.findByHash('hash')).rejects.toThrow('database unavailable');
		service.invalidate();
		const current = service.findByHash('hash');
		rejectOld(new Error('database unavailable'));
		await old;
		const coalesced = service.findByHash('hash');
		finishNew(row);
		await Promise.all([current, coalesced]);
		expect(query).toHaveBeenCalledTimes(2);
	});

	it('never retains negative lookups', async () => {
		query.mockResolvedValue(null);
		for (let i = 0; i < 3; i++) expect(await service.findByHash('missing')).toBeNull();
		expect(query).toHaveBeenCalledTimes(3);
	});

	it('limits retained facts with LRU eviction', async () => {
		for (let i = 0; i < tokenMetadataCapacity; i++) await service.findByHash(`hash-${i}`);
		await service.findByHash('hash-0'); // Keep the first credential hot.
		await service.findByHash('overflow');
		query.mockClear();
		await service.findByHash('hash-0');
		expect(query).not.toHaveBeenCalled();
		await service.findByHash('hash-1');
		expect(query).toHaveBeenCalledTimes(1);
	});

	it('bounds pending coalescing while falling back to fresh reads on overflow', async () => {
		let finish!: (row: LongLiveTokenEntity) => void;
		const delayed = new Promise<LongLiveTokenEntity>((resolve) => (finish = resolve));
		query.mockReturnValue(delayed);
		const requests = Array.from({ length: tokenMetadataCapacity }, (_, i) => service.findByHash(`hash-${i}`));
		requests.push(service.findByHash('overflow'), service.findByHash('overflow'), service.findByHash('hash-0'));
		expect(query).toHaveBeenCalledTimes(tokenMetadataCapacity + 2);
		finish(row);
		await Promise.all(requests);
		query.mockClear();
		await service.findByHash('overflow');
		expect(query).toHaveBeenCalledTimes(1);
	});

	it('invalidates combined usage/security updates rather than treating them as telemetry', async () => {
		await service.findByHash('hash');
		service.afterUpdate({
			metadata: { inheritanceTree: [TokenEntity, LongLiveTokenEntity] },
			entity: { lastUsedAt: new Date(), revoked: true },
			queryRunner: { isTransactionActive: false },
		} as unknown as UpdateEvent<LongLiveTokenEntity>);
		query.mockResolvedValue({ ...row, revoked: true });
		expect((await service.findByHash('hash')).revoked).toBe(true);
	});

	it('unregisters itself and prevents pending reads from refilling after shutdown', async () => {
		let finish!: (row: LongLiveTokenEntity) => void;
		query.mockImplementationOnce(() => new Promise<LongLiveTokenEntity>((resolve) => (finish = resolve)));
		const pending = service.findByHash('hash');
		const unrelated = {};
		database.subscribers.push(unrelated);
		service.onModuleDestroy();
		finish(row);
		await pending;
		expect(database.subscribers).toEqual([unrelated]);
		query.mockClear();
		await service.findByHash('hash');
		expect(query).toHaveBeenCalledTimes(1);
	});
});
