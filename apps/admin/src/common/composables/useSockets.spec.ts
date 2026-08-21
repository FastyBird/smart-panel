import { effectScope } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSockets } from './useSockets';

const mockEmitWithAck = vi.fn();

const mockTimeout = vi.fn(() => ({
	emitWithAck: mockEmitWithAck,
}));

const mockOn = vi.fn();
const mockOff = vi.fn();

const socketInstanceMock = {
	connected: false,
	active: false,
	timeout: mockTimeout,
	on: mockOn,
	off: mockOff,
};

vi.mock('../services/sockets', () => ({
	injectSockets: vi.fn(() => socketInstanceMock),
}));

describe('useSockets', () => {
	beforeEach(() => {
		socketInstanceMock.connected = true;
		socketInstanceMock.active = true;

		mockEmitWithAck.mockReset();
		mockOn.mockReset();
		mockOff.mockReset();
	});

	it('subscribes to connect and disconnect when called outside a component setup', () => {
		// `useSockets` is called from `scenes.store.ts` — a Pinia store setup, which runs with no
		// active component instance but inside Pinia's own effect scope (`effectScope().run(setup)`).
		// Plain `onMounted` silently declines to register there (Vue only warns), so the listeners
		// were never attached and `connected` / `active` on that instance stayed frozen at their
		// initial values for the life of the app. The effect scope is what makes the listeners safe
		// to attach — see the "no scope at all" case below for the contrast.
		const scope = effectScope();

		scope.run(() => useSockets());

		expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
		expect(mockOn).toHaveBeenCalledWith('disconnect', expect.any(Function));
	});

	it('tracks connect and disconnect events when called outside a component setup', () => {
		socketInstanceMock.connected = false;
		socketInstanceMock.active = false;

		const scope = effectScope();

		const { connected, active } = scope.run(() => useSockets())!;

		const onConnect = mockOn.mock.calls.find(([event]) => event === 'connect')?.[1] as () => void;
		const onDisconnect = mockOn.mock.calls.find(([event]) => event === 'disconnect')?.[1] as () => void;

		onConnect();
		expect(connected.value).toBe(true);
		expect(active.value).toBe(true);

		onDisconnect();
		expect(connected.value).toBe(false);
		expect(active.value).toBe(false);
	});

	it('does not attach listeners when there is no scope to release them', () => {
		// Called bare — no component, no effectScope. `tryOnScopeDispose` would be a silent
		// no-op here, so attaching listeners would leak them on the app-lifetime socket forever.
		useSockets();

		expect(mockOn).not.toHaveBeenCalled();
	});

	it('attaches and releases listeners inside a bare effect scope', () => {
		const scope = effectScope();

		scope.run(() => useSockets());
		expect(mockOn).toHaveBeenCalledTimes(2);

		scope.stop();
		expect(mockOff).toHaveBeenCalledTimes(2);
	});

	it('still defers to the component lifecycle when called inside a component setup', async () => {
		// The fix must not regress the ordinary path: inside a component the subscription has to
		// wait for mount and be released on unmount, not run eagerly during setup.
		const { defineComponent } = await import('vue');
		const { mount } = await import('@vue/test-utils');

		const Host = defineComponent({
			setup() {
				useSockets();

				return () => null;
			},
		});

		const wrapper = mount(Host);

		expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
		expect(mockOff).not.toHaveBeenCalled();

		wrapper.unmount();

		expect(mockOff).toHaveBeenCalledWith('connect', expect.any(Function));
		expect(mockOff).toHaveBeenCalledWith('disconnect', expect.any(Function));
	});

	it('returns connected and active state', () => {
		const { connected, active } = useSockets();

		expect(connected.value).toBe(true);
		expect(active.value).toBe(true);
	});

	it('returns true on successful command', async () => {
		mockEmitWithAck.mockResolvedValue({
			status: 'ok',
			message: 'Success',
			results: [{ handler: 'test-handler', success: true }],
		});

		const { sendCommand } = useSockets();

		const result = await sendCommand('EVENT', {}, 'test-handler');
		expect(result).toBe(true);
	});

	it('returns error message on response error', async () => {
		mockEmitWithAck.mockResolvedValue({
			status: 'err',
			message: 'Something went wrong',
			results: [],
		});

		const { sendCommand } = useSockets();

		const result = await sendCommand('EVENT', {}, 'test-handler');
		expect(result).toBe('Something went wrong');
	});

	it('returns handler reason on failed command result', async () => {
		mockEmitWithAck.mockResolvedValue({
			status: 'ok',
			message: 'OK',
			results: [{ handler: 'test-handler', success: false, reason: 'Invalid input' }],
		});

		const { sendCommand } = useSockets();

		const result = await sendCommand('EVENT', {}, 'test-handler');
		expect(result).toBe('Invalid input');
	});

	it('returns fallback error when no response is received', async () => {
		mockEmitWithAck.mockResolvedValue(undefined);

		const { sendCommand } = useSockets();

		const result = await sendCommand('EVENT', {}, 'test-handler');
		expect(result).toBe('err');
	});
});
