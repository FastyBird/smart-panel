import { nextTick } from 'vue';

import { ElDialog, ElInputNumber, ElSelect, ElSwitch } from 'element-plus';
import createClient from 'openapi-fetch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { paths } from '../../../openapi';
import { ActivityDraftSchema, ClimateMode } from '../composables/activityModes.schemas';

import SpaceActivityModesSection from './space-activity-modes-section.vue';

const harness = vi.hoisted(() => ({ client: null as unknown, role: 'owner' }));
vi.mock('../../../common', () => ({ useBackend: () => ({ client: harness.client }) }));
vi.mock('../../../modules/auth/composables/useSession', async () => {
	const { computed } = await import('vue');
	return { useSession: () => ({ profile: computed(() => ({ role: harness.role })) }) };
});
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key.split('activityModes.').pop() }) }));

const configuration = () => ({
	lighting: { enabled: true, mode: 'work' },
	climate: { enabled: false },
	covers: { enabled: true, position: 50 },
	media: { enabled: false, activity: 'off' },
	security: { enabled: false },
});
const row = (mode: string, revision = 1) => ({
	id: mode,
	space_id: 'space',
	created_at: '2026-10-16T00:00:00Z',
	type: 'activity_config',
	activity_mode: mode,
	activity_enabled: mode !== 'away',
	activity_order: mode === 'away' ? 0 : 1,
	activity_revision: revision,
	activity_configuration: configuration(),
});
let requests: { method: string; path: string; body?: { data: Record<string, unknown> } }[];
let conflict: boolean;
let previewGate: Promise<void> | null;
let fetchMock: (request: Request) => Promise<Response>;
const json = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });
const render = () =>
	mount(SpaceActivityModesSection, { props: { spaceId: 'space' }, global: { stubs: { teleport: false } }, attachTo: document.body });
const click = async (wrapper: ReturnType<typeof render>, id: string) => {
	await wrapper.get(`[data-testid="${id}"]`).trigger('click');
	await flushPromises();
};

beforeEach(() => {
	requests = [];
	conflict = false;
	previewGate = null;
	harness.role = 'owner';
	fetchMock = vi.fn(async (request: Request) => {
		const path = new URL(request.url).pathname;
		const body = request.method === 'GET' ? undefined : await request.json();
		requests.push({ method: request.method, path, body });
		const mode = path.split('/')[8];
		if (path.endsWith('/preview')) {
			if (previewGate) await previewGate;
			return json([{ domain: 'climate', status: 'unsupported', reason: 'trusted adapter unavailable' }]);
		}
		if (request.method === 'PUT' || path.endsWith('/reset')) {
			if (conflict) return json(null, 409);
			return json({
				...row(mode, 2),
				activity_enabled: body.data.enabled ?? true,
				activity_order: body.data.display_order ?? 1,
				activity_configuration: body.data.configuration ?? configuration(),
			});
		}
		return json(row(mode, conflict ? 2 : 1));
	});
	harness.client = createClient<paths>({ baseUrl: 'http://localhost/api/v1', fetch: fetchMock });
});
afterEach(() => {
	document.body.innerHTML = '';
});

describe('actual activity mode section and saved API editor', () => {
	it('reads all five config endpoints including disabled modes, with no initialization writes', async () => {
		const wrapper = render();
		await flushPromises();
		expect(requests).toHaveLength(5);
		expect(requests.every((request) => request.method === 'GET' && request.path.endsWith('/config'))).toBe(true);
		expect(wrapper.text()).toContain('modes.away');
		expect(wrapper.text()).toContain('disabled');
		wrapper.unmount();
	});
	it('enables a disabled built-in from the list using its own saved revision', async () => {
		const wrapper = render();
		await flushPromises();
		wrapper
			.findAllComponents(ElSwitch)
			.find((control) => control.attributes('data-testid') === 'toggle-away')!
			.vm.$emit('change', true);
		await flushPromises();
		expect(requests.find((request) => request.method === 'PUT')?.body?.data).toMatchObject({ enabled: true, expected_revision: 1 });
		expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
		wrapper.unmount();
	});
	it('saves enable/order changes with saved revision, disables draft preview and resets with new revision', async () => {
		const wrapper = render();
		await flushPromises();
		await click(wrapper, 'edit-work');
		await wrapper.findComponent(ElDialog).findAllComponents(ElSwitch)[0].vm.$emit('update:modelValue', false);
		await wrapper.findAllComponents(ElInputNumber)[0].vm.$emit('update:modelValue', 7);
		await nextTick();
		expect(wrapper.get('[data-testid="preview"]').attributes('disabled')).toBeDefined();
		await click(wrapper, 'save');
		const saved = requests.find((request) => request.method === 'PUT');
		expect(saved?.body?.data).toMatchObject({ enabled: false, display_order: 7, expected_revision: 1 });
		expect(saved?.body?.data.configuration).toEqual(configuration());
		await click(wrapper, 'reset');
		expect(requests.at(-1)?.body).toEqual({ data: { expected_revision: 2 } });
		wrapper.unmount();
	});
	it('previews saved revision only and invalidates displayed results on any draft edit', async () => {
		const wrapper = render();
		await flushPromises();
		await click(wrapper, 'edit-work');
		await click(wrapper, 'preview');
		expect(requests.at(-1)?.body).toEqual({ data: { expected_revision: 1 } });
		expect(requests.filter((request) => request.method !== 'GET')).toHaveLength(1);
		expect(wrapper.findAll('[data-testid="domain-result"]')).toHaveLength(1);
		wrapper.findComponent(ElDialog).findAllComponents(ElSwitch)[0].vm.$emit('update:modelValue', false);
		await nextTick();
		expect(wrapper.findAll('[data-testid="domain-result"]')).toHaveLength(0);
		expect(wrapper.text()).toContain('saveBeforePreview');
		wrapper.unmount();
	});
	it('409 refreshes saved truth, preserves draft and prevents hidden retry or overwrite', async () => {
		const wrapper = render();
		await flushPromises();
		await click(wrapper, 'edit-work');
		wrapper.findAllComponents(ElInputNumber)[0].vm.$emit('update:modelValue', 7);
		await nextTick();
		conflict = true;
		await click(wrapper, 'save');
		expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
		expect(requests.at(-1)?.method).toBe('GET');
		expect(wrapper.findAllComponents(ElInputNumber)[0].props('modelValue')).toBe(7);
		expect(wrapper.text()).toContain('conflictReview');
		expect(wrapper.get('[data-testid="save"]').attributes('disabled')).toBeDefined();
		wrapper.unmount();
	});
	it('read-only users can inspect saved readiness but cannot save configuration', async () => {
		harness.role = 'user';
		const wrapper = render();
		await flushPromises();
		await click(wrapper, 'edit-work');
		expect(wrapper.get('[data-testid="reset"]').attributes('disabled')).toBeDefined();
		await click(wrapper, 'preview');
		expect(requests.at(-1)?.path).toContain('/preview');
		wrapper.unmount();
	});
	it('requires an explicit climate input and saves only the chosen preset', async () => {
		const wrapper = render();
		await flushPromises();
		await click(wrapper, 'edit-work');
		wrapper.findComponent(ElDialog).findAllComponents(ElSwitch)[2].vm.$emit('update:modelValue', true);
		await nextTick();
		expect(wrapper.get('[data-testid="save"]').attributes('disabled')).toBeDefined();
		wrapper.findAllComponents(ElSelect)[1].vm.$emit('update:modelValue', 'preset');
		await nextTick();
		expect(wrapper.get('[data-testid="save"]').attributes('disabled')).toBeDefined();
		wrapper.findAllComponents(ElSelect)[2].vm.$emit('update:modelValue', 'comfort');
		await nextTick();
		await click(wrapper, 'save');
		const body = requests.find((request) => request.method === 'PUT')?.body;
		expect(body?.data.configuration).toMatchObject({ climate: { enabled: true, thermostat_preset: 'comfort' } });
		expect((body?.data.configuration as ReturnType<typeof configuration>).climate).not.toHaveProperty('mode');
		wrapper.unmount();
	});
	it('ignores a late preview when the selected space changes', async () => {
		let finish!: () => void;
		previewGate = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const wrapper = render();
		await flushPromises();
		await click(wrapper, 'edit-work');
		await click(wrapper, 'preview');
		await wrapper.setProps({ spaceId: 'another-space' });
		await flushPromises();
		finish();
		await flushPromises();
		expect(wrapper.findAll('[data-testid="domain-result"]')).toHaveLength(0);
		expect(requests.filter((request) => request.method !== 'GET')).toHaveLength(1);
		wrapper.unmount();
	});
	it('rejects implicit Work climate presets, mixed preset/numeric intents and numeric off/auto', () => {
		const draft = { enabled: true, display_order: 0, configuration: configuration() };
		expect(ActivityDraftSchema.safeParse(draft).success).toBe(true);
		const withClimate = (climate: Record<string, unknown>) => ({ ...draft, configuration: { ...draft.configuration, climate } });
		expect(ActivityDraftSchema.safeParse(withClimate({ enabled: true })).success).toBe(false);
		expect(ActivityDraftSchema.safeParse(withClimate({ enabled: true, thermostat_preset: 'work' })).success).toBe(false);
		expect(
			ActivityDraftSchema.safeParse(withClimate({ enabled: true, thermostat_preset: 'comfort', setpoint: 20, mode: ClimateMode.heat })).success
		).toBe(false);
		expect(ActivityDraftSchema.safeParse(withClimate({ enabled: true, setpoint: 20, mode: ClimateMode.auto })).success).toBe(false);
		expect(ActivityDraftSchema.safeParse(withClimate({ enabled: true, setpoint: 20, mode: ClimateMode.heat })).success).toBe(true);
	});
});
