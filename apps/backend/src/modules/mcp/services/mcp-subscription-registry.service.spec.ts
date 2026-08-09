import {
	MCP_MAX_ACTIVE_SUBSCRIPTIONS,
	MCP_MAX_SUBSCRIPTIONS_PER_CLIENT,
	MCP_SUBSCRIPTION_IDLE_TIMEOUT_MS,
} from '../mcp.constants';

import { McpAuditService } from './mcp-audit.service';
import { McpSubscriptionCapacityError, McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

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

	afterEach(() => {
		service.closeAll();
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

	it('cleans up every stream during application shutdown', () => {
		const first = service.open('client-a');
		const second = service.open('client-b');

		service.onApplicationShutdown();

		expect(first.signal.aborted).toBe(true);
		expect(second.signal.aborted).toBe(true);
		expect(service.activeCount).toBe(0);
	});

	it('closes only OAuth streams matching a revoked artifact identity', () => {
		const staticStream = service.open('client-a');
		const first = service.open('client-a', 'one', {
			accessTokenId: 'access-one',
			grantId: 'grant-one',
			refreshFamilyId: 'family-one',
			authorizationDeadline: new Date(Date.now() + 60_000),
		});
		const other = service.open('client-a', 'two', {
			accessTokenId: 'access-two',
			grantId: 'grant-two',
			refreshFamilyId: 'family-two',
			authorizationDeadline: new Date(Date.now() + 60_000),
		});

		service.closeOAuthAccessToken('access-one');

		expect(first.signal.aborted).toBe(true);
		expect(other.signal.aborted).toBe(false);
		expect(staticStream.signal.aborted).toBe(false);

		service.closeOAuthRefreshFamily('family-two');

		expect(other.signal.aborted).toBe(true);
		expect(staticStream.signal.aborted).toBe(false);
	});

	it('closes OAuth streams at their authorization deadline', () => {
		jest.useFakeTimers();
		const subscription = service.open('client-a', 'deadline', {
			accessTokenId: 'access-one',
			grantId: 'grant-one',
			authorizationDeadline: new Date(Date.now() + 1_000),
		});

		jest.advanceTimersByTime(999);
		expect(subscription.signal.aborted).toBe(false);
		jest.advanceTimersByTime(1);

		expect(subscription.signal.aborted).toBe(true);
		expect(auditService.recordSubscriptionClosed).toHaveBeenCalledWith(
			{ requestId: 'deadline', clientId: 'client-a' },
			subscription.id,
			'authorization_expired',
		);
	});
});
