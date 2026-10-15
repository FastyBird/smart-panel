import { ElButton, ElCheckbox, ElInputNumber, ElSelect } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import type { ComfortSnapshot } from '../services/thermostat-comfort';

import VirtualThermostatComfort from './virtual-thermostat-comfort.vue';

const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), on: vi.fn(), off: vi.fn() }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../../common', () => ({ useBackend: () => ({}), injectSockets: () => ({ on: mocks.on, off: mocks.off }) }));
vi.mock('../services/thermostat-comfort', async (original) => ({ ...(await original<object>()), thermostatComfortTransport: () => mocks }));
const legacy = (cooling = false): ComfortSnapshot =>
	({
		comfort: {
			controller: 'a',
			revision: 4,
			graph_revision: 8,
			configuration: null,
			effective: {
				source: 'manual',
				heating_setpoint: cooling ? null : 0,
				cooling_setpoint: cooling ? 25 : null,
				preset: null,
				override_id: null,
				expires_at: null,
			},
			clock_policy: 'future-clock-policy',
		},
		configuration: {
			revision: 4,
			requested_mode: 'off',
			locked: false,
			policy: { heatingSetpoint: cooling ? null : 0, coolingSetpoint: cooling ? 25 : null },
		},
		runtime: {
			configuration_revision: 4,
			reasons: ['floor_overheat'],
			branches: [{ role: 'heating', activity: 'unknown', fault: 'release_pending' }],
		},
	}) as unknown as ComfortSnapshot;
const configured = (): ComfortSnapshot => {
	const data = legacy();
	data.comfort.configuration = {
		heating_range: { minimum: 0, maximum: 30 },
		cooling_range: null,
		presets: [{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } }],
		automation_enabled: false,
		automation_baseline: null,
		selected_preset: null,
		user_off: true,
		temporary_override: {
			id: 'exact-override',
			status: 'active',
			source: 'user',
			actor_id: 'real-user',
			revision: 3,
			expires_at: new Date(Date.now() + 60_000).toISOString(),
			created_at: new Date().toISOString(),
			preset: 'eco',
			setpoints: null,
			resolved_setpoints: { heating_setpoint: 17, cooling_setpoint: null },
			terminated_at: null,
		},
	} as ComfortSnapshot['comfort']['configuration'];
	return data;
};
let wrapper: VueWrapper | undefined;
const open = async () => {
	wrapper = mount(VirtualThermostatComfort, { props: { deviceId: 'a' } });
	await flushPromises();
	return wrapper;
};
const button = (view: VueWrapper, key: string) => view.findAll('button').find((node) => node.text() === `devicesVirtualPlugin.comfort.${key}`)!;
beforeEach(() => {
	vi.clearAllMocks();
	mocks.read.mockResolvedValue(legacy());
	mocks.write.mockResolvedValue(undefined);
});
afterEach(() => {
	wrapper?.unmount();
	wrapper = undefined;
	vi.useRealTimers();
});

describe('thermostat comfort editor', () => {
	it.each([false, true])('leaves legacy temperatures blank and exposes only supported branch inputs (cooling=%s)', async (cooling) => {
		mocks.read.mockResolvedValue(legacy(cooling));
		const view = await open();
		expect(view.text()).toContain('devicesVirtualPlugin.comfort.unconfigured');
		expect(view.findAllComponents(ElInputNumber)).toHaveLength(2);
		expect(view.findAllComponents(ElInputNumber).every((input) => input.props('modelValue') == null)).toBe(true);
		expect(view.findAllComponents(ElCheckbox).every((input) => input.props('modelValue') === false)).toBe(true);
		expect(button(view, 'save').attributes('disabled')).toBeDefined();
		expect(view.text()).toContain('floor_overheat');
		expect(view.text()).toContain('release_pending');
		expect(mocks.write).not.toHaveBeenCalled();
	});
	it('configures explicit zero-valued ranges, no seeded presets and explicit false automation', async () => {
		const view = await open();
		const inputs = view.findAllComponents(ElInputNumber);
		for (const [index, value] of [0, 30].entries()) {
			inputs[index].vm.$emit('update:modelValue', value);
			inputs[index].vm.$emit('change', value);
			await flushPromises();
		}
		await button(view, 'save').trigger('click');
		await flushPromises();
		expect(mocks.write).toHaveBeenCalledWith('a', expect.objectContaining({ revision: 4, graph_revision: 8 }), {
			kind: 'configure',
			input: { heating_range: { minimum: 0, maximum: 30 }, cooling_range: null, presets: [], automation_enabled: false },
		});
	});
	it('keeps OFF clear separate, cancels the exact override, and displays the new current baseline from the server', async () => {
		const first = configured();
		mocks.read.mockResolvedValue(first);
		const view = await open();
		expect(view.text()).toContain('real-user');
		expect(view.text()).toContain('exact-override');
		expect(view.text()).toContain('future-clock-policy');
		await view.get('[data-test-id="clear-user-off"]').trigger('click');
		await flushPromises();
		expect(mocks.write.mock.calls[0][2]).toEqual({ kind: 'selection', preset: null, clear_user_off: true });
		const current = structuredClone(first);
		current.comfort.configuration!.temporary_override!.status = 'cancelled' as never;
		current.comfort.effective.heating_setpoint = 19;
		current.comfort.revision = 6;
		current.configuration.revision = 6;
		current.runtime.configuration_revision = 6;
		mocks.read.mockResolvedValue(current);
		await view.get('[data-test-id="cancel-override"]').trigger('click');
		await flushPromises();
		expect(mocks.write.mock.calls[1][2]).toEqual({ kind: 'cancel', override_id: 'exact-override' });
		expect(view.text()).toContain('19 / —');
		expect(view.find('[data-test-id="cancel-override"]').exists()).toBe(false);
	});
	it('rejects a cancellation handler rendered for an older override identity/revision', async () => {
		mocks.read.mockResolvedValue(configured());
		const view = await open();
		const cancel = view.findAllComponents(ElButton).find((node) => node.attributes('data-test-id') === 'cancel-override')!;
		const staleClick = cancel.vm.$.vnode.props!.onClick as () => void;
		const replacement = configured();
		replacement.comfort.revision = 9;
		replacement.configuration.revision = 9;
		replacement.runtime.configuration_revision = 9;
		replacement.comfort.configuration!.temporary_override!.id = 'replacement';
		mocks.read.mockResolvedValue(replacement);
		await button(view, 'reload').trigger('click');
		await flushPromises();
		staleClick();
		await flushPromises();
		expect(mocks.write).not.toHaveBeenCalled();
		expect(view.text()).toContain('replacement');
	});

	it('selects the manual baseline with clear OFF false and does not manufacture output confirmation', async () => {
		mocks.read.mockResolvedValue(configured());
		const view = await open();
		const select = view.findAllComponents(ElSelect)[0];
		select.vm.$emit('update:modelValue', 'manual');
		select.vm.$emit('change', 'manual');
		await flushPromises();
		await button(view, 'choose').trigger('click');
		await flushPromises();
		expect(mocks.write.mock.calls[0][2]).toEqual({ kind: 'selection', preset: null, clear_user_off: false });
		expect(view.text()).toContain('unknown');
	});
	it('creates an explicit bounded override without sending actor/source or unsupported setpoints', async () => {
		mocks.read.mockResolvedValue(configured());
		const view = await open();
		const inputs = view.findAllComponents(ElInputNumber),
			temperature = inputs.at(-2)!,
			duration = inputs.at(-1)!;
		expect(temperature.props('modelValue')).toBeNull();
		expect(duration.props('modelValue')).toBeNull();
		for (const [input, value] of [
			[temperature, 0],
			[duration, 5],
		] as const) {
			input.vm.$emit('update:modelValue', value);
			input.vm.$emit('change', value);
			await flushPromises();
		}
		await view.get('[data-test-id="create-override"]').trigger('click');
		await flushPromises();
		const action = mocks.write.mock.calls[0][2];
		expect(action).toMatchObject({ kind: 'override', preset: null, setpoints: { heating_setpoint: 0, cooling_setpoint: null } });
		expect(Object.keys(action).sort()).toEqual(['expires_at', 'kind', 'preset', 'setpoints']);
		expect(Date.parse(action.expires_at)).toBeGreaterThan(Date.now());
	});

	it('refetches at absolute expiry without cancelling or inventing a new expiry', async () => {
		vi.useFakeTimers();
		const data = configured();
		mocks.read.mockResolvedValue(data);
		const view = await open();
		const expiry = data.comfort.configuration!.temporary_override!.expires_at;
		await vi.advanceTimersByTimeAsync(60_000);
		await flushPromises();
		expect(mocks.read.mock.calls.length).toBeGreaterThan(1);
		expect(mocks.write).not.toHaveBeenCalled();
		expect(view.text()).toContain(expiry);
	});
	it('shows unknown states conservatively and retains server validation errors after reload', async () => {
		const data = configured();
		data.comfort.configuration!.temporary_override!.status = 'future-hold' as never;
		mocks.read.mockResolvedValue(data);
		const view = await open();
		expect(view.text()).toContain('devicesVirtualPlugin.comfort.uncertain');
		expect(button(view, 'choose').attributes('disabled')).toBeDefined();
		mocks.read.mockResolvedValue(configured());
		await button(view, 'reload').trigger('click');
		await flushPromises();
		mocks.write.mockRejectedValue(new Error('overlapping_setpoints'));
		await button(view, 'choose').trigger('click');
		await flushPromises();
		expect(view.text()).toContain('overlapping_setpoints');
	});
});
