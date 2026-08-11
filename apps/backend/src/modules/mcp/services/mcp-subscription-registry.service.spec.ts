import {
	MCP_MAX_ACTIVE_SUBSCRIPTIONS,
	MCP_MAX_SUBSCRIPTIONS_PER_CLIENT,
	MCP_SUBSCRIPTION_IDLE_TIMEOUT_MS,
	McpOAuthScope,
} from '../mcp.constants';

import { McpAuditService } from './mcp-audit.service';
import {
	McpOAuthSubscriptionBinding,
	McpOAuthSubscriptionRegistration,
	McpSubscriptionCapacityError,
	McpSubscriptionClosingError,
	McpSubscriptionRegistryService,
} from './mcp-subscription-registry.service';

const deferred = <T = void>(): { promise: Promise<T>; resolve: (value: T) => void } => {
	let resolve = (_value: T): void => undefined;
	const promise = new Promise<T>((resolver) => {
		resolve = resolver;
	});

	return { promise, resolve };
};

const oauthBinding = (overrides: Partial<McpOAuthSubscriptionBinding> = {}): McpOAuthSubscriptionBinding => ({
	accessTokenId: 'access-one',
	approverAuthorityGeneration: 0,
	approverId: 'approver-one',
	grantId: 'grant-one',
	authorizationDeadline: new Date(Date.now() + 60_000),
	effectiveScopes: [McpOAuthScope.READ],
	modulePolicyGeneration: 1,
	oauthEnabledGeneration: 4,
	publicIdentityGeneration: 5,
	serverSecretVersion: 6,
	clientGeneration: 2,
	grantGeneration: 3,
	...overrides,
});

const oauthRegistration = (overrides: Partial<McpOAuthSubscriptionBinding> = {}): McpOAuthSubscriptionRegistration => ({
	clientId: 'client-a',
	binding: oauthBinding(overrides),
});

describe('McpSubscriptionRegistryService', () => {
	let service: McpSubscriptionRegistryService;
	let auditService: { recordSubscriptionClosed: jest.Mock; recordSubscriptionOpened: jest.Mock };

	beforeEach(() => {
		auditService = {
			recordSubscriptionClosed: jest.fn(),
			recordSubscriptionOpened: jest.fn(),
		};
		service = new McpSubscriptionRegistryService(auditService as unknown as McpAuditService);
	});

	afterEach(async () => {
		await service.closeAll();
		jest.useRealTimers();
	});

	it('tracks and closes streams for only the targeted client', () => {
		const first = service.open('client-a');
		const second = service.open('client-a');
		const other = service.open('client-b');

		service.closeClient('client-a');

		expect(first.signal.aborted).toBe(true);
		expect(second.signal.aborted).toBe(true);
		expect(other.signal.aborted).toBe(false);
		expect(service.activeCount).toBe(1);
		expect(service.countForClient('client-b')).toBe(1);
		expect(auditService.recordSubscriptionOpened).toHaveBeenCalledTimes(3);
		expect(auditService.recordSubscriptionClosed).toHaveBeenCalledTimes(2);
	});

	it('enforces the per-client cap', () => {
		for (let index = 0; index < MCP_MAX_SUBSCRIPTIONS_PER_CLIENT; index += 1) {
			service.open('client-a');
		}

		expect(() => service.open('client-a')).toThrow(McpSubscriptionCapacityError);
		expect(() => service.open('client-b')).not.toThrow();
	});

	it('enforces the global cap across clients', () => {
		for (let index = 0; index < MCP_MAX_ACTIVE_SUBSCRIPTIONS; index += 1) {
			service.open(`client-${Math.floor(index / MCP_MAX_SUBSCRIPTIONS_PER_CLIENT)}`);
		}

		expect(service.activeCount).toBe(MCP_MAX_ACTIVE_SUBSCRIPTIONS);
		expect(() => service.open('one-too-many')).toThrow(McpSubscriptionCapacityError);
	});

	it('expires idle subscriptions and allows activity to renew the timer', () => {
		jest.useFakeTimers();
		const subscription = service.open('client-a');

		jest.advanceTimersByTime(MCP_SUBSCRIPTION_IDLE_TIMEOUT_MS - 1);
		subscription.touch();
		jest.advanceTimersByTime(MCP_SUBSCRIPTION_IDLE_TIMEOUT_MS - 1);

		expect(subscription.signal.aborted).toBe(false);

		jest.advanceTimersByTime(1);

		expect(subscription.signal.aborted).toBe(true);
		expect(service.activeCount).toBe(0);
		expect(auditService.recordSubscriptionClosed).toHaveBeenCalledWith(
			{ requestId: 'unknown', clientId: 'client-a' },
			subscription.id,
			'idle',
		);
	});

	it('cleans up every stream during application shutdown', async () => {
		const first = service.open('client-a');
		const second = service.open('client-b');

		await service.onApplicationShutdown();

		expect(first.signal.aborted).toBe(true);
		expect(second.signal.aborted).toBe(true);
		expect(service.activeCount).toBe(0);
	});

	it('closes only OAuth streams matching a revoked artifact identity', async () => {
		const staticStream = service.open('client-a');
		const first = await service.openOAuth('one', () =>
			Promise.resolve(
				oauthRegistration({
					accessTokenId: 'access-one',
					grantId: 'grant-one',
					refreshFamilyId: 'family-one',
				}),
			),
		);
		const other = await service.openOAuth('two', () =>
			Promise.resolve(
				oauthRegistration({
					accessTokenId: 'access-two',
					grantId: 'grant-two',
					refreshFamilyId: 'family-two',
				}),
			),
		);

		await service.closeOAuthAccessToken('access-one', () => Promise.resolve());

		expect(first.signal.aborted).toBe(true);
		expect(other.signal.aborted).toBe(false);
		expect(staticStream.signal.aborted).toBe(false);

		await service.closeOAuthRefreshFamily('family-two', () => Promise.resolve());

		expect(other.signal.aborted).toBe(true);
		expect(staticStream.signal.aborted).toBe(false);
	});

	it('closes a registration that wins the gate before matching invalidation', async () => {
		const revalidationStarted = deferred();
		const releaseRevalidation = deferred();
		const advanceGeneration = jest.fn().mockResolvedValue(undefined);
		const registrationPromise = service.openOAuth('racing-open', async () => {
			revalidationStarted.resolve();
			await releaseRevalidation.promise;

			return oauthRegistration();
		});

		await revalidationStarted.promise;

		const invalidationPromise = service.closeOAuthAccessToken('access-one', advanceGeneration);

		await Promise.resolve();
		expect(advanceGeneration).not.toHaveBeenCalled();

		releaseRevalidation.resolve();
		const subscription = await registrationPromise;

		await invalidationPromise;

		expect(advanceGeneration).toHaveBeenCalledTimes(1);
		expect(subscription.signal.aborted).toBe(true);
		expect(auditService.recordSubscriptionClosed).toHaveBeenCalledWith(
			{ requestId: 'racing-open', clientId: 'client-a' },
			subscription.id,
			'authorization_revoked',
		);
	});

	it('serializes close-all behind a pending OAuth registration and closes the resulting stream', async () => {
		const staticStream = service.open('static-client');
		const revalidationStarted = deferred();
		const releaseRevalidation = deferred();
		const registrationPromise = service.openOAuth('shutdown-race', async () => {
			revalidationStarted.resolve();
			await releaseRevalidation.promise;

			return oauthRegistration();
		});

		await revalidationStarted.promise;

		const closePromise = service.closeAll();

		expect(service.activeCount).toBe(0);
		expect(staticStream.signal.aborted).toBe(true);
		releaseRevalidation.resolve();
		const subscription = await registrationPromise;

		await closePromise;

		expect(subscription.signal.aborted).toBe(true);
		expect(service.activeCount).toBe(0);
		expect(auditService.recordSubscriptionClosed).toHaveBeenCalledWith(
			{ requestId: 'shutdown-race', clientId: 'client-a' },
			subscription.id,
			'shutdown',
		);
	});

	it('rejects OAuth registrations that arrive after close-all joins the gate', async () => {
		const advanceStarted = deferred();
		const releaseAdvance = deferred();
		const invalidationPromise = service.closeAllOAuth(async () => {
			advanceStarted.resolve();
			await releaseAdvance.promise;
		});

		await advanceStarted.promise;

		const closePromise = service.closeAll();
		const revalidate = jest.fn().mockResolvedValue(oauthRegistration());

		expect(() => service.open('late-static-open')).toThrow(McpSubscriptionClosingError);
		await expect(service.openOAuth('late-open', revalidate)).rejects.toThrow(McpSubscriptionClosingError);
		expect(revalidate).not.toHaveBeenCalled();

		releaseAdvance.resolve();
		await invalidationPromise;
		await closePromise;

		expect(service.activeCount).toBe(0);
		await expect(service.openOAuth('post-close-open', revalidate)).resolves.toEqual(expect.any(Object));
	});

	it('makes a registration queued behind invalidation revalidate after its generation advances', async () => {
		const advanceStarted = deferred();
		const releaseAdvance = deferred();
		const invalidationPromise = service.closeOAuthGrant('grant-one', async () => {
			advanceStarted.resolve();
			await releaseAdvance.promise;
		});

		await advanceStarted.promise;

		const revalidate = jest.fn().mockRejectedValue(new Error('stale authorization generation'));
		const registrationPromise = service.openOAuth('stale-open', revalidate);
		const rejectedRegistration = expect(registrationPromise).rejects.toThrow('stale authorization generation');

		await Promise.resolve();
		expect(revalidate).not.toHaveBeenCalled();

		releaseAdvance.resolve();
		await invalidationPromise;
		await rejectedRegistration;
		expect(revalidate).toHaveBeenCalledTimes(1);
		expect(service.activeCount).toBe(0);
	});

	it('propagates generation-advance failure without closing matching OAuth streams', async () => {
		const subscription = await service.openOAuth('failed-invalidation', () => Promise.resolve(oauthRegistration()));

		await expect(
			service.closeOAuthAccessToken('access-one', () => Promise.reject(new Error('generation update failed'))),
		).rejects.toThrow('generation update failed');

		expect(subscription.signal.aborted).toBe(false);
	});

	it('closes only OAuth streams whose effective scopes exceed the new module ceiling', async () => {
		const staticStream = service.open('static-client');
		const readStream = await service.openOAuth('read-stream', () => Promise.resolve(oauthRegistration()));
		const writeStream = await service.openOAuth('write-stream', () =>
			Promise.resolve(
				oauthRegistration({
					effectiveScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE],
				}),
			),
		);
		const advanceGeneration = jest.fn().mockResolvedValue(undefined);

		await service.closeOAuthScopeContractions([McpOAuthScope.READ], advanceGeneration);

		expect(advanceGeneration).toHaveBeenCalledTimes(1);
		expect(readStream.signal.aborted).toBe(false);
		expect(writeStream.signal.aborted).toBe(true);
		expect(staticStream.signal.aborted).toBe(false);
	});

	it('closes only matching grant streams whose effective scopes exceed the updated approval', async () => {
		const staticStream = service.open('static-client');
		const matchingRead = await service.openOAuth('matching-read', () => Promise.resolve(oauthRegistration()));
		const matchingWrite = await service.openOAuth('matching-write', () =>
			Promise.resolve(
				oauthRegistration({
					effectiveScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE],
				}),
			),
		);
		const otherGrant = await service.openOAuth('other-grant', () =>
			Promise.resolve(
				oauthRegistration({
					grantId: 'grant-two',
					effectiveScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE],
				}),
			),
		);
		const advanceGeneration = jest.fn().mockResolvedValue(undefined);

		await service.closeOAuthGrantScopeContractions('grant-one', [McpOAuthScope.READ], advanceGeneration);

		expect(advanceGeneration).toHaveBeenCalledTimes(1);
		expect(matchingRead.signal.aborted).toBe(false);
		expect(matchingWrite.signal.aborted).toBe(true);
		expect(otherGrant.signal.aborted).toBe(false);
		expect(staticStream.signal.aborted).toBe(false);
	});

	it('closes only OAuth streams approved by the invalidated user', async () => {
		const matching = await service.openOAuth('matching-approver', () => Promise.resolve(oauthRegistration()));
		const other = await service.openOAuth('other-approver', () =>
			Promise.resolve(oauthRegistration({ approverId: 'approver-two' })),
		);
		const staticStream = service.open('static-client');
		const advanceGeneration = jest.fn().mockResolvedValue(undefined);

		await service.closeOAuthApprover('approver-one', advanceGeneration);

		expect(advanceGeneration).toHaveBeenCalledTimes(1);
		expect(matching.signal.aborted).toBe(true);
		expect(other.signal.aborted).toBe(false);
		expect(staticStream.signal.aborted).toBe(false);
	});

	it('closes OAuth streams at their authorization deadline', async () => {
		jest.useFakeTimers();
		const subscription = await service.openOAuth('deadline', () =>
			Promise.resolve(
				oauthRegistration({
					authorizationDeadline: new Date(Date.now() + 1_000),
				}),
			),
		);

		jest.advanceTimersByTime(500);
		subscription.touch();
		jest.advanceTimersByTime(499);
		expect(subscription.signal.aborted).toBe(false);
		jest.advanceTimersByTime(1);

		expect(subscription.signal.aborted).toBe(true);
		expect(auditService.recordSubscriptionClosed).toHaveBeenCalledWith(
			{ requestId: 'deadline', clientId: 'client-a' },
			subscription.id,
			'authorization_expired',
		);
	});

	it('cancels the authorization deadline timer when an OAuth stream closes early', async () => {
		jest.useFakeTimers();
		const subscription = await service.openOAuth('early-close', () =>
			Promise.resolve(
				oauthRegistration({
					authorizationDeadline: new Date(Date.now() + 60_000),
				}),
			),
		);

		expect(jest.getTimerCount()).toBe(2);

		subscription.close();

		expect(subscription.signal.aborted).toBe(true);
		expect(jest.getTimerCount()).toBe(0);
	});
});
