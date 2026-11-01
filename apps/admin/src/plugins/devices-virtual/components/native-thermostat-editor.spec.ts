import { ref } from 'vue';

import { ElInput, ElInputNumber, ElMessageBox, ElSelect } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import type { NativeSnapshot } from '../services/native-thermostat';

import NativeThermostatEditor from './NativeThermostatEditor.vue';

const mocks = vi.hoisted(() => ({
	read: vi.fn(),
	candidates: vi.fn(),
	create: vi.fn(),
	request: vi.fn(),
	revalidate: vi.fn(),
	release: vi.fn(),
	profile: { value: { role: 'admin' } },
}));
vi.mock('../../../common', () => ({ useBackend: () => ({}) }));
vi.mock('../../../modules/auth/composables/useSession', () => ({ useSession: () => ({ profile: mocks.profile }) }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn(), onBeforeRouteUpdate: vi.fn() }));
vi.mock('../services/native-thermostat', async (original) => ({ ...(await original<object>()), nativeThermostatTransport: () => mocks }));
const snapshot = (id = 'controller'): NativeSnapshot => ({
	controller: id,
	binding_state: 'bound',
	drift: [],
	control_strategy: 'native_unit',
	revision: 3,
	source_device: 'source',
	provider: 'zigbee2mqtt',
	physical_identity: 'zigbee:unit',
	fingerprint: 'v1',
	capabilities: { modes: ['off', 'heat'], heating: { minimum: 5, maximum: 30, step: 0.5 }, cooling: null, supportsCompound: false },
	requested: { mode: 'heat', heatingSetpoint: 20 },
	observed: {
		available: false,
		temperature: null,
		mode: null,
		heatingSetpoint: null,
		coolingSetpoint: null,
		activity: null,
		observedAt: null,
		reasons: ['stale'],
	},
	latest_request: { id: 'old', state: 'settled', operations: [{ operation: 'mode', outcome: 'accepted', confirmed: false }] },
});
let view: VueWrapper | undefined;
const open = async (props: { deviceId?: string; create?: boolean } = { deviceId: 'controller' }) => {
	view = mount(NativeThermostatEditor, { props });
	await flushPromises();
	return view;
};
beforeEach(() => {
	vi.clearAllMocks();
	mocks.profile = ref({ role: 'admin' });
	mocks.read.mockResolvedValue(snapshot());
	mocks.request.mockImplementation(async () => ({ ...snapshot(), revision: 4 }));
	mocks.candidates.mockResolvedValue([
		{ device: 'source', name: 'Room', provider: 'zigbee2mqtt', reasons: [], capabilities: snapshot().capabilities },
	]);
	mocks.create.mockResolvedValue(snapshot());
});
afterEach(() => {
	view?.unmount();
	view = undefined;
	vi.useRealTimers();
});
describe('native thermostat authoring and commands', () => {
	it('keeps accepted requests separate from unavailable observed activity', async () => {
		const page = await open();
		expect(page.get('[data-test-id="native-observed"]').text()).toContain('unavailable');
		expect(page.get('[data-test-id="native-outcome"]').text()).toContain('accepted');
		expect(mocks.request).not.toHaveBeenCalled();
	});
	it('sends only the explicit Zigbee setpoint with the current revision and a request identity', async () => {
		const page = await open();
		page.findComponent(ElInputNumber).vm.$emit('update:modelValue', 21.5);
		await flushPromises();
		await page.get('[data-test-id="native-heating"]').trigger('click');
		await flushPromises();
		expect(mocks.request).toHaveBeenCalledWith('controller', 3, expect.any(String), { heating_setpoint: 21.5 }, expect.any(AbortSignal));
		expect(mocks.request.mock.calls[0][2]).toMatch(/^[0-9a-f-]{36}$/);
	});
	it('requires a new authoritative read after an uncertain mutation', async () => {
		mocks.request.mockRejectedValueOnce(new Error('lost response'));
		const page = await open();
		await page.get('[data-test-id="native-mode"]').trigger('click');
		await flushPromises();
		expect(page.text()).toContain('uncertain');
		expect(page.get('[data-test-id="native-mode"]').attributes('disabled')).toBeDefined();
		await page.get('[data-test-id="native-refresh"]').trigger('click');
		await flushPromises();
		expect(page.get('[data-test-id="native-mode"]').attributes('disabled')).toBeUndefined();
	});
	it('fences a late old-controller read after rebinding', async () => {
		let release!: (value: NativeSnapshot) => void;
		mocks.read.mockReturnValueOnce(
			new Promise((resolve) => {
				release = resolve;
			})
		);
		const page = await open();
		mocks.read.mockResolvedValueOnce(snapshot('new'));
		await page.setProps({ deviceId: 'new' });
		await flushPromises();
		release(snapshot());
		await flushPromises();
		await page.get('[data-test-id="native-mode"]').trigger('click');
		await flushPromises();
		expect(mocks.request.mock.calls[0][0]).toBe('new');
	});
	it('offers explicit same-unit revalidation when capabilities are unavailable', async () => {
		mocks.read.mockResolvedValueOnce({ ...snapshot(), capabilities: null });
		const page = await open();
		expect(page.find('[data-test-id="native-mode"]').exists()).toBe(false);
		mocks.revalidate.mockResolvedValueOnce(snapshot());
		await page.get('[data-test-id="native-revalidate"]').trigger('click');
		await flushPromises();
		expect(mocks.revalidate).toHaveBeenCalledWith('controller', 3, 'source', expect.any(AbortSignal));
	});
	it('keeps non-author users read-only', async () => {
		mocks.profile.value.role = 'user';
		const page = await open();
		expect(page.find('[data-test-id="native-mode"]').exists()).toBe(false);
		expect(page.find('[data-test-id="native-revalidate"]').exists()).toBe(false);
	});
	it('creates a named unit without issuing an initial physical request', async () => {
		const page = await open({ create: true });
		page.findComponent(ElInput).vm.$emit('update:modelValue', 'Bedroom');
		page.findComponent(ElSelect).vm.$emit('update:modelValue', 'source');
		await flushPromises();
		await page.get('[data-test-id="native-create"]').trigger('click');
		await flushPromises();
		expect(mocks.create).toHaveBeenCalledWith('Bedroom', 'source', expect.any(AbortSignal));
		expect(mocks.request).not.toHaveBeenCalled();
		expect(page.emitted('created')).toEqual([['controller']]);
	});

	it('releases only the reservation after confirmation and leaves physical requests untouched', async () => {
		const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>);
		mocks.release.mockResolvedValueOnce({ ...snapshot(), binding_state: 'released', revision: 5 });
		try {
			const page = await open();
			await page.get('[data-test-id="native-release"]').trigger('click');
			await flushPromises();
			expect(confirm).toHaveBeenCalledWith('devicesVirtualPlugin.nativeThermostat.releaseHelp');
			expect(mocks.release).toHaveBeenCalledWith('controller', 3, expect.any(AbortSignal));
			expect(mocks.request).not.toHaveBeenCalled();
			expect(page.find('[data-test-id="native-mode"]').exists()).toBe(false);
		} finally {
			confirm.mockRestore();
		}
	});

	it('polls current observations without replacing an edited target and withholds failed read data', async () => {
		vi.useFakeTimers();
		const current = snapshot();
		current.observed = { ...current.observed, available: true, temperature: 19, activity: 'heating' };
		mocks.read.mockResolvedValueOnce(current);
		const page = await open();
		page.findComponent(ElInputNumber).vm.$emit('update:modelValue', 22);
		await flushPromises();
		expect(page.get('[data-test-id="native-observed"]').text()).toContain('19');
		await vi.advanceTimersByTimeAsync(5_000);
		await flushPromises();
		expect(page.findComponent(ElInputNumber).props('modelValue')).toBe(22);
		expect(mocks.request).not.toHaveBeenCalled();
		mocks.read.mockRejectedValueOnce(new Error('offline'));
		await vi.advanceTimersByTimeAsync(5_000);
		await flushPromises();
		expect(page.get('[data-test-id="native-observed"]').text()).toContain('unavailable');
		expect(page.get('[data-test-id="native-mode"]').attributes('disabled')).toBeDefined();
	});

	it('settles a stalled read at the total deadline and permits an explicit refresh', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		mocks.read.mockReturnValueOnce(new Promise(() => undefined));
		const page = await open();
		expect(page.get('[data-test-id="native-refresh"]').attributes('disabled')).toBeDefined();
		await vi.advanceTimersByTimeAsync(10_000);
		await flushPromises();
		expect(page.text()).toContain('readFailed');
		expect(page.get('[data-test-id="native-refresh"]').attributes('disabled')).toBeUndefined();
	});
});
