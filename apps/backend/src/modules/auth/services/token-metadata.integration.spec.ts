import { Socket } from 'socket.io';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { McpCapability } from '../../mcp/mcp.constants';
import { UserEntity } from '../../users/entities/users.entity';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { WsAuthService } from '../../websocket/services/ws-auth.service';
import { WebsocketNotAllowedException } from '../../websocket/websocket.exceptions';
import { TokenOwnerType } from '../auth.constants';
import { AuthException } from '../auth.exceptions';
import { AccessTokenEntity, LongLiveTokenEntity, RefreshTokenEntity, TokenEntity } from '../entities/auth.entity';
import { AuthGuard, AuthenticatedRequest } from '../guards/auth.guard';
import { hashToken } from '../utils/token.utils';

import { TokenMetadataService } from './token-metadata.service';
import { TokenUsageService } from './token-usage.service';
import { TokensService } from './tokens.service';

describe('Runtime credential facts with real SQLite and JWT verification', () => {
	let database: DataSource;
	let metadata: TokenMetadataService;
	let usage: TokenUsageService;
	let tokens: TokensService;
	let jwt: JwtService;
	let guard: AuthGuard;
	let ws: WsAuthService;
	let credential: string;
	let row: LongLiveTokenEntity;
	let isMcp: boolean;
	const ownerId = uuid();
	const mcp = { findActiveByToken: jest.fn(), getEffectiveCapabilities: jest.fn() };

	beforeEach(async () => {
		database = await new DataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [UserEntity, TokenEntity, AccessTokenEntity, RefreshTokenEntity, LongLiveTokenEntity],
		}).initialize();
		metadata = new TokenMetadataService(database, new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }));
		usage = new TokenUsageService(database);
		tokens = new TokensService(database.getRepository(TokenEntity), null as never, database, usage, metadata);
		jwt = new JwtService({ secret: 'test-only-local-signing-secret' });
		credential = jwt.sign({ sub: ownerId, type: TokenOwnerType.DISPLAY }, { expiresIn: 3600 });
		row = await insert(credential, TokenOwnerType.DISPLAY, ownerId);
		isMcp = false;
		const users = {
			findOne: (id: string) => database.getRepository(UserEntity).findOneBy({ id }),
		} as UsersService;
		mcp.findActiveByToken.mockResolvedValue({ enabled: true });
		mcp.getEffectiveCapabilities.mockReturnValue([McpCapability.READ]);
		guard = new AuthGuard(
			jwt,
			{ getAllAndOverride: (key: string) => (key === 'isPublic' ? false : isMcp) } as unknown as Reflector,
			tokens,
			users,
			mcp as never,
			{ getAudience: () => Promise.resolve('test-audience') } as never,
			{ recordAuthenticationFailure: jest.fn(), getRequestId: () => null } as never,
			{ isOpen: false } as never,
			{} as never,
		);
		ws = new WsAuthService(jwt, tokens, users);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await usage?.beforeApplicationShutdown();
		metadata?.onModuleDestroy();
		if (database?.isInitialized) await database.destroy();
	});

	async function insert(raw: string, ownerType: TokenOwnerType, tokenOwnerId: string | null, id?: string) {
		return database.getRepository(LongLiveTokenEntity).save(
			Object.assign(new LongLiveTokenEntity(), {
				...(id ? { id } : {}),
				hashedToken: raw,
				name: 'Test credential',
				ownerType,
				tokenOwnerId,
				expiresAt: null,
			}),
		);
	}

	async function authenticate(raw = credential) {
		const request = { headers: { authorization: `Bearer ${raw}` } } as AuthenticatedRequest;
		const context = {
			getHandler: () => null,
			getClass: () => null,
			switchToHttp: () => ({ getRequest: () => request }),
		} as ExecutionContext;
		await guard.canActivate(context);
		return request.auth;
	}

	function socket(raw = credential) {
		return { handshake: { auth: { token: raw } }, data: {} } as unknown as Socket;
	}

	it('authenticates warm display HTTP requests and WS handshakes without ORM, including after telemetry flush', async () => {
		await authenticate();
		await usage.flush();
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		const repository = jest.spyOn(database, 'getRepository');
		const verify = jest.spyOn(jwt, 'verifyAsync');
		expect(await authenticate()).toMatchObject({ tokenId: row.id, ownerId, ownerType: TokenOwnerType.DISPLAY });
		expect(await ws.validateClient(socket())).toBe(true);
		expect(verify).toHaveBeenCalledTimes(2);
		expect(query).not.toHaveBeenCalled();
		expect(repository).not.toHaveBeenCalled();
	});

	it.each(['revoke', 'delete', 'rotate', 'owner', 'type', 'expire'] as const)(
		'rejects both transports immediately after %s',
		async (change) => {
			await authenticate();
			const repository = database.getRepository(LongLiveTokenEntity);
			if (change === 'revoke') await tokens.revokeByOwnerId(ownerId, TokenOwnerType.DISPLAY);
			if (change === 'delete') await repository.delete(row.id);
			if (change === 'rotate') await repository.update(row.id, { hashedToken: hashToken('replacement') });
			if (change === 'owner') await repository.update(row.id, { tokenOwnerId: uuid() });
			if (change === 'type') await repository.update(row.id, { ownerType: TokenOwnerType.USER });
			if (change === 'expire') await repository.update(row.id, { expiresAt: new Date(Date.now() - 1000) });
			await expect(authenticate()).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(ws.validateClient(socket())).rejects.toBeInstanceOf(WebsocketNotAllowedException);
		},
	);

	it('rejects a warmed token when time passes its database expiry without a mutation', async () => {
		const expiry = Date.now() + 1000;
		await database.getRepository(LongLiveTokenEntity).update(row.id, { expiresAt: new Date(expiry) });
		await authenticate();
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
		try {
			jest.setSystemTime(expiry + 1);
			await expect(authenticate()).rejects.toBeInstanceOf(UnauthorizedException);
		} finally {
			jest.useRealTimers();
		}
	});

	it('shares a third-party credential lookup across HTTP and WebSocket without enumerating tokens', async () => {
		credential = jwt.sign({ type: TokenOwnerType.THIRD_PARTY });
		row = await insert(credential, TokenOwnerType.THIRD_PARTY, null);
		await authenticate();
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		expect(await ws.validateClient(socket())).toBe(true);
		expect(query).not.toHaveBeenCalled();
		await tokens.revoke(row.id);
		await expect(ws.validateClient(socket())).rejects.toBeInstanceOf(WebsocketNotAllowedException);
	});

	it('does not bypass JWT verification when facts are cached', async () => {
		await authenticate();
		jest.spyOn(jwt, 'verifyAsync').mockRejectedValueOnce(new Error('expired or invalid signature'));
		await expect(authenticate()).rejects.toBeInstanceOf(UnauthorizedException);
	});

	it('keeps usage timestamps fresh for administrative reads and isolates facts from callers', async () => {
		const facts = await tokens.findAuthenticationTokenByHash(hashToken(credential));
		expect(Object.keys(facts).sort()).toEqual(['expiresAt', 'hashedToken', 'id', 'ownerId', 'ownerType', 'revoked']);
		facts.revoked = true;
		facts.ownerId = uuid();
		expect((await tokens.findAuthenticationTokenByHash(hashToken(credential))).ownerId).toBe(ownerId);
		await authenticate();
		await usage.flush();
		expect((await tokens.findOneByHashedToken(hashToken(credential))).lastUsedAt).toBeInstanceOf(Date);
	});

	it.each(['commitTransaction', 'rollbackTransaction'] as const)(
		'never retains transaction-time grants across nested %s and outer rollback',
		async (settleInner) => {
			await tokens.revoke(row.id);
			const runner = database.createQueryRunner();
			await runner.startTransaction();
			try {
				await runner.manager.update(LongLiveTokenEntity, row.id, { revoked: false });
				await runner.startTransaction();
				await runner.manager.update(LongLiveTokenEntity, row.id, { name: 'Uncommitted' });
				await authenticate();
				await runner[settleInner]();
				await authenticate();
				await runner.rollbackTransaction();
				await expect(authenticate()).rejects.toBeInstanceOf(UnauthorizedException);
			} finally {
				while (runner.isTransactionActive) await runner.rollbackTransaction();
				await runner.release();
			}
		},
	);

	it('revokes cached facts after a committed transaction and permits a rolled-back revocation', async () => {
		await authenticate();
		const runner = database.createQueryRunner();
		await runner.startTransaction();
		await runner.manager.update(LongLiveTokenEntity, row.id, { revoked: true });
		await expect(authenticate()).rejects.toBeInstanceOf(UnauthorizedException);
		await runner.rollbackTransaction();
		await authenticate();
		await database.transaction((manager) => tokens.revoke(row.id, manager));
		await expect(authenticate()).rejects.toBeInstanceOf(UnauthorizedException);
		await runner.release();
	});

	it('does not reuse facts when a deleted token ID is replaced', async () => {
		await authenticate();
		await database.getRepository(LongLiveTokenEntity).delete(row.id);
		const replacement = jwt.sign({ sub: ownerId, type: TokenOwnerType.DISPLAY, nonce: 'replacement' });
		await insert(replacement, TokenOwnerType.DISPLAY, ownerId, row.id);
		await expect(authenticate()).rejects.toBeInstanceOf(UnauthorizedException);
		expect((await authenticate(replacement)).type).toBe('token');
	});

	it('reads user roles on every request even when token facts are warm', async () => {
		const user = await database.getRepository(UserEntity).save({ username: 'test', role: UserRole.ADMIN });
		credential = jwt.sign({ sub: user.id, type: TokenOwnerType.USER });
		await insert(credential, TokenOwnerType.USER, user.id);
		expect((await authenticate()).role).toBe(UserRole.ADMIN);
		await database.getRepository(UserEntity).update(user.id, { role: UserRole.USER });
		expect((await authenticate()).role).toBe(UserRole.USER);
	});

	it('checks MCP client policy on every request and prevents MCP WS admission', async () => {
		isMcp = true;
		credential = jwt.sign({ sub: ownerId, type: TokenOwnerType.MCP }, { audience: 'test-audience' });
		await insert(credential, TokenOwnerType.MCP, ownerId);
		await authenticate();
		mcp.getEffectiveCapabilities.mockReturnValue([]);
		expect(await authenticate()).toMatchObject({ capabilities: [] });
		mcp.findActiveByToken.mockResolvedValue(null);
		await expect(authenticate()).rejects.toBeInstanceOf(UnauthorizedException);
		await expect(ws.validateClient(socket())).rejects.toBeInstanceOf(WebsocketNotAllowedException);
	});

	it('bypasses the cache for independent writers and observes listener-disabled revocation', async () => {
		metadata.onModuleDestroy();
		metadata = new TokenMetadataService(database, new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: true }));
		await metadata.findByHash(hashToken(credential));
		await database
			.createQueryBuilder()
			.update(LongLiveTokenEntity)
			.set({ revoked: true })
			.where('id = :id', { id: row.id })
			.callListeners(false)
			.execute();
		expect((await metadata.findByHash(hashToken(credential))).revoked).toBe(true);
	});

	it('supports explicit invalidation after bulk clear', async () => {
		await authenticate();
		await database.getRepository(LongLiveTokenEntity).clear();
		metadata.invalidate();
		await expect(authenticate()).rejects.toBeInstanceOf(UnauthorizedException);
	});
	async function createAccess() {
		const user = await database.getRepository(UserEntity).save({ username: 'access-owner', role: UserRole.ADMIN });
		credential = jwt.sign({ sub: user.id, role: UserRole.ADMIN }, { expiresIn: 3600 });
		const access = await database.getRepository(AccessTokenEntity).save(
			Object.assign(new AccessTokenEntity(), {
				hashedToken: credential,
				ownerId: user.id,
				expiresAt: new Date(Date.now() + 3600_000),
			}),
		);
		const refresh = await database.getRepository(RefreshTokenEntity).save(
			Object.assign(new RefreshTokenEntity(), {
				hashedToken: 'refresh-credential',
				ownerId: user.id,
				parentId: access.id,
			}),
		);
		return { user, access, refresh };
	}

	it('authenticates a warm access credential on HTTP and WS without ORM or a second user read', async () => {
		const { user } = await createAccess();
		await authenticate();
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		const repository = jest.spyOn(database, 'getRepository');
		const verify = jest.spyOn(jwt, 'verifyAsync');
		expect(await authenticate()).toEqual({ type: 'user', id: user.id, role: UserRole.ADMIN });
		const client = socket();
		expect(await ws.validateClient(client)).toBe(true);
		expect(client.data).toEqual({ user: { type: 'user', id: user.id, role: UserRole.ADMIN } });
		expect(verify).toHaveBeenCalledTimes(2);
		expect(query).not.toHaveBeenCalled();
		expect(repository).not.toHaveBeenCalled();
	});

	it('updates cached access roles after ORM edits rather than trusting the signed role claim', async () => {
		const { user } = await createAccess();
		await authenticate();
		await database.getRepository(UserEntity).update(user.id, { role: UserRole.USER });
		expect((await authenticate()).role).toBe(UserRole.USER);
		const client = socket();
		await ws.validateClient(client);
		expect(client.data).toMatchObject({ user: { role: UserRole.USER } });
	});

	it.each(['access revoke', 'refresh revoke', 'access delete', 'user delete', 'rotate', 'owner transfer'] as const)(
		'rejects warm access credentials on both transports after %s',
		async (change) => {
			const { user, access, refresh } = await createAccess();
			await authenticate();
			if (change === 'access revoke') await tokens.revokeUserCredentials(user.id);
			if (change === 'refresh revoke')
				await database.getRepository(RefreshTokenEntity).update(refresh.id, { revoked: true });
			if (change === 'access delete') await database.getRepository(AccessTokenEntity).delete(access.id);
			if (change === 'user delete') await database.getRepository(UserEntity).delete(user.id);
			if (change === 'rotate')
				await database.getRepository(AccessTokenEntity).update(access.id, { hashedToken: hashToken('replacement') });
			if (change === 'owner transfer') {
				const other = await database.getRepository(UserEntity).save({ username: 'other-user' });
				await database.getRepository(AccessTokenEntity).update(access.id, { ownerId: other.id });
			}
			await expect(authenticate()).rejects.toBeInstanceOf(UnauthorizedException);
			await expect(ws.validateClient(socket())).rejects.toBeInstanceOf(WebsocketNotAllowedException);
		},
	);

	it.each(['missing', 'multiple'])(
		'retains the %s refresh-child rejection after warming an access credential',
		async (condition) => {
			const { user, access, refresh } = await createAccess();
			await authenticate();
			if (condition === 'missing') await database.getRepository(RefreshTokenEntity).delete(refresh.id);
			else
				await database.getRepository(RefreshTokenEntity).save(
					Object.assign(new RefreshTokenEntity(), {
						hashedToken: 'extra-refresh',
						ownerId: user.id,
						parentId: access.id,
					}),
				);
			await expect(authenticate()).rejects.toBeInstanceOf(AuthException);
			await expect(ws.validateClient(socket())).rejects.toBeInstanceOf(AuthException);
		},
	);

	it('requires both owner and hash and isolates the projected owner facts', async () => {
		const { user, access } = await createAccess();
		const hash = hashToken(credential);
		const facts = await tokens.findAuthenticationAccessToken(user.id, hash);
		expect(facts).toMatchObject({ id: access.id, owner: { id: user.id, role: UserRole.ADMIN }, refreshRevoked: false });
		expect(Object.keys(facts.owner).sort()).toEqual(['id', 'role']);
		facts.owner.role = UserRole.OWNER;
		facts.expiresAt.setFullYear(1990);
		expect((await tokens.findAuthenticationAccessToken(user.id, hash)).owner.role).toBe(UserRole.ADMIN);
		expect(await tokens.findAuthenticationAccessToken(uuid(), hash)).toBeNull();
		expect(await tokens.findAuthenticationAccessToken(user.id, hashToken('refresh-credential'))).toBeNull();
		expect(await tokens.findAuthenticationTokenByHash(hash)).toBeNull();
	});

	it.each(['commitTransaction', 'rollbackTransaction'] as const)(
		'does not retain a user-role grant across nested %s and outer rollback',
		async (settleInner) => {
			const { user } = await createAccess();
			await database.getRepository(UserEntity).update(user.id, { role: UserRole.USER });
			await authenticate();
			const runner = database.createQueryRunner();
			await runner.startTransaction();
			try {
				await runner.manager.update(UserEntity, user.id, { role: UserRole.OWNER });
				await runner.startTransaction();
				await runner.manager.update(UserEntity, user.id, { firstName: 'Uncommitted' });
				expect((await authenticate()).role).toBe(UserRole.OWNER);
				await runner[settleInner]();
				expect((await authenticate()).role).toBe(UserRole.OWNER);
				await runner.rollbackTransaction();
				expect((await authenticate()).role).toBe(UserRole.USER);
			} finally {
				while (runner.isTransactionActive) await runner.rollbackTransaction();
				await runner.release();
			}
		},
	);

	it('observes independent role and refresh mutations with cache bypass enabled', async () => {
		const { user, refresh } = await createAccess();
		metadata.onModuleDestroy();
		metadata = new TokenMetadataService(database, new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: true }));
		await metadata.findAccessToken(user.id, hashToken(credential));
		await database
			.createQueryBuilder()
			.update(UserEntity)
			.set({ role: UserRole.USER })
			.where('id = :id', { id: user.id })
			.callListeners(false)
			.execute();
		await database
			.createQueryBuilder()
			.update(RefreshTokenEntity)
			.set({ revoked: true })
			.where('id = :id', { id: refresh.id })
			.callListeners(false)
			.execute();
		expect(await metadata.findAccessToken(user.id, hashToken(credential))).toMatchObject({
			owner: { role: UserRole.USER },
			refreshRevoked: true,
		});
	});
	it('retains revoked-access rejection even when its refresh child is absent', async () => {
		const { access, refresh } = await createAccess();
		await authenticate();
		await database.getRepository(AccessTokenEntity).update(access.id, { revoked: true });
		await database.getRepository(RefreshTokenEntity).delete(refresh.id);
		await expect(authenticate()).rejects.toBeInstanceOf(UnauthorizedException);
	});
});
