import {
	MCP_MAX_ACTIVE_SUBSCRIPTIONS,
	MCP_MAX_SUBSCRIPTIONS_PER_CLIENT,
	MCP_SUBSCRIPTION_IDLE_TIMEOUT_MS,
} from '../mcp.constants';

import { McpSubscriptionCapacityError, McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

describe('McpSubscriptionRegistryService', () => {
	let service: McpSubscriptionRegistryService;

	beforeEach(() => {
		service = new McpSubscriptionRegistryService();
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
	});

	it('cleans up every stream during application shutdown', () => {
		const first = service.open('client-a');
		const second = service.open('client-b');

		service.onApplicationShutdown();

		expect(first.signal.aborted).toBe(true);
		expect(second.signal.aborted).toBe(true);
		expect(service.activeCount).toBe(0);
	});
});
