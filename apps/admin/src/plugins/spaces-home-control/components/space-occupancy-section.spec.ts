import { computed } from 'vue';
import { createI18n } from 'vue-i18n';

import { ElCheckboxGroup, ElInputNumber, ElSelect, ElSwitch } from 'element-plus';
import createClient from 'openapi-fetch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { paths } from '../../../openapi';
import cs from '../locales/cs-CZ.json';
import de from '../locales/de-DE.json';
import en from '../locales/en-US.json';
import es from '../locales/es-ES.json';
import pl from '../locales/pl-PL.json';
import sk from '../locales/sk-SK.json';

import SpaceOccupancySection from './SpaceOccupancySection.vue';

const harness = vi.hoisted(() => ({ client: null as unknown, role: 'owner' }));
vi.mock('../../../common', () => ({ useBackend: () => ({ client: harness.client }) }));
vi.mock('../../../modules/auth/composables/useSession', () => ({ useSession: () => ({ profile: computed(() => ({ role: harness.role })) }) }));
const locales = { 'en-US': en, 'cs-CZ': cs, 'sk-SK': sk, 'de-DE': de, 'es-ES': es, 'pl-PL': pl };
const sensor = '5d6976c1-7600-4695-8612-8ebc09558d67';
const initial = (space = 'space') => ({
	id: 'config',
	space_id: space,
	created_at: '2026-11-02T00:00:00Z',
	revision: 1,
	enabled: false,
	vacancy_timeout_seconds: 900,
	maximum_age_seconds: 3600,
	sensor_property_ids: [] as string[],
	occupied_mode: null as string | null,
	vacant_mode: null as string | null,
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });
let stored: ReturnType<typeof initial>;
let writes: Record<string, unknown>[];
let conflict: boolean;
let loseResponse: boolean;
let manualOverride: boolean;
let resumes: number;
let resumeBodies: unknown[];
let resumeConflict: boolean;
let failConfiguration: boolean;
let failSupplemental: 'sensors' | 'state' | null;
let wrappers: ReturnType<typeof mount>[];
const render = (locale: keyof typeof locales = 'en-US') => {
	const wrapper = mount(SpaceOccupancySection, {
		props: { spaceId: 'space' },
		global: {
			plugins: [createI18n({ legacy: false, locale, messages: { [locale]: { spacesHomeControlPlugin: locales[locale] } } })],
			stubs: { teleport: false },
		},
	});
	wrappers.push(wrapper);
	return wrapper;
};
beforeEach(() => {
	stored = initial();
	writes = [];
	conflict = false;
	loseResponse = false;
	manualOverride = false;
	resumes = 0;
	resumeBodies = [];
	resumeConflict = false;
	failConfiguration = false;
	failSupplemental = null;
	wrappers = [];
	harness.role = 'owner';
	harness.client = createClient<paths>({
		baseUrl: 'http://localhost/api/v1',
		fetch: async (request: Request) => {
			const path = new URL(request.url).pathname;
			if (request.method === 'POST' && path.endsWith('/resume')) {
				resumes++;
				resumeBodies.push(await request.json());
				stored.revision++;
				if (resumeConflict) return json(null, 409);
				manualOverride = false;
				return new Promise<never>((_, reject) => {
					request.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
				});
			}
			if (request.method === 'PUT') {
				const body = await request.json();
				writes.push(body.data);
				if (conflict) {
					stored.revision = 2;
					return json(null, 409);
				}
				stored = { ...stored, ...body.data, revision: stored.revision + 1 };
				if (loseResponse)
					return new Promise<never>((_, reject) => {
						request.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
					});
				return json(stored);
			}
			if (failSupplemental && path.endsWith('/' + failSupplemental)) throw new Error('Supplemental request failed');
			if (path.endsWith('/sensors')) return json([{ property_id: sensor, device_id: 'device', label: 'Office motion' }]);
			if (path.endsWith('/state'))
				return json({
					space_id: 'space',
					status: 'unknown',
					enabled: stored.enabled,
					running: true,
					manual_override: manualOverride,
					vacancy_remaining_seconds: null,
					last_attempt_status: null,
				});
			return failConfiguration ? json(null, 500) : json(stored);
		},
	});
});
afterEach(() => {
	for (const wrapper of wrappers) wrapper.unmount();
	vi.useRealTimers();
});
const choose = async (wrapper: ReturnType<typeof render>) => {
	wrapper.findComponent(ElSwitch).vm.$emit('update:modelValue', true);
	wrapper.findComponent(ElCheckboxGroup).vm.$emit('update:modelValue', [sensor]);
	await flushPromises();
};
describe('occupancy editor using the actual API client', () => {
	it.each(Object.keys(locales) as (keyof typeof locales)[])('renders real %s labels and unknown state without a write', async (locale) => {
		const wrapper = render(locale);
		await flushPromises();
		expect(wrapper.text()).toContain(locales[locale].occupancy.title);
		expect(wrapper.get('[data-testid="occupancy-observed"]').text()).toContain(locales[locale].occupancy.unknown);
		expect(writes).toHaveLength(0);
	});
	it('saves selected sensors, timeout and explicit modes with revision CAS', async () => {
		const wrapper = render();
		await flushPromises();
		await choose(wrapper);
		wrapper.findAllComponents(ElInputNumber)[0]!.vm.$emit('update:modelValue', 1);
		for (const [key, mode] of [
			['occupancy-occupied-mode', 'work'],
			['occupancy-vacant-mode', 'away'],
		]) {
			wrapper
				.findAllComponents(ElSelect)
				.find((select) => select.attributes('data-testid') === key)!
				.vm.$emit('update:modelValue', mode);
		}
		await flushPromises();
		await wrapper.get('[data-testid="occupancy-save"]').trigger('click');
		await flushPromises();
		expect(writes).toEqual([
			expect.objectContaining({
				expected_revision: 1,
				enabled: true,
				sensor_property_ids: [sensor],
				vacancy_timeout_seconds: 60,
				maximum_age_seconds: 3600,
				occupied_mode: 'work',
				vacant_mode: 'away',
			}),
		]);
		expect(wrapper.vm.hasUnsavedChanges).toBe(false);
	});
	it('keeps a conflicting draft until Discard loads revision 2', async () => {
		const wrapper = render();
		await flushPromises();
		await choose(wrapper);
		conflict = true;
		await wrapper.get('[data-testid="occupancy-save"]').trigger('click');
		await flushPromises();
		expect(wrapper.vm.hasUnsavedChanges).toBe(true);
		expect(wrapper.get('[data-testid="occupancy-save"]').attributes('disabled')).toBeDefined();
		expect(writes).toHaveLength(1);
		await wrapper.get('[data-testid="occupancy-discard"]').trigger('click');
		await flushPromises();
		conflict = false;
		await choose(wrapper);
		await wrapper.get('[data-testid="occupancy-save"]').trigger('click');
		await flushPromises();
		expect(writes[1]).toMatchObject({ expected_revision: 2 });
	});
	it('reconciles an unconfirmed saved response while preserving the draft and bounded wait', async () => {
		const wrapper = render();
		await flushPromises();
		await choose(wrapper);
		loseResponse = true;
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		await wrapper.get('[data-testid="occupancy-save"]').trigger('click');
		await flushPromises();
		await vi.advanceTimersByTimeAsync(30_000);
		await flushPromises();
		await wrapper.vm.waitForSave();
		expect(wrapper.text()).toContain(en.occupancy.saveUnconfirmed);
		expect(wrapper.vm.hasUnsavedChanges).toBe(true);
		await wrapper.get('[data-testid="occupancy-discard"]').trigger('click');
		await flushPromises();
		expect(wrapper.findComponent(ElSwitch).props('modelValue')).toBe(true);
		expect(wrapper.vm.hasUnsavedChanges).toBe(false);
		expect(writes).toHaveLength(1);
	});
	it('keeps an unconfirmed Resume visible after bounded read reconciliation and never replays the POST', async () => {
		manualOverride = true;
		const wrapper = render();
		await flushPromises();
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		await wrapper.get('[data-testid="occupancy-resume"]').trigger('click');
		await flushPromises();
		await vi.advanceTimersByTimeAsync(10_000);
		await flushPromises();
		await wrapper.vm.waitForSave();
		expect(resumes).toBe(1);
		expect(resumeBodies).toEqual([{ data: { expected_revision: 1 } }]);
		expect(stored.revision).toBe(2);
		expect(wrapper.find('[data-testid="occupancy-resume"]').exists()).toBe(false);
		expect(wrapper.text()).toContain(en.occupancy.saveUnconfirmed);
		await wrapper.get('[data-testid="occupancy-refresh"]').trigger('click');
		await flushPromises();
		expect(wrapper.text()).not.toContain(en.occupancy.saveUnconfirmed);
		expect(resumes).toBe(1);
	});
	it('disables Resume if only observed state loaded and configuration failed', async () => {
		manualOverride = true;
		failConfiguration = true;
		const wrapper = render();
		await flushPromises();
		expect(wrapper.get('[data-testid="occupancy-resume"]').attributes('disabled')).toBeDefined();
		expect(wrapper.text()).toContain(en.occupancy.loadFailed);
		expect(resumes).toBe(0);
	});
	it.each(['sensors', 'state'] as const)('keeps the independent successful response when %s fails', async (failed) => {
		manualOverride = true;
		failSupplemental = failed;
		const wrapper = render();
		await flushPromises();
		expect(wrapper.text()).toContain(en.occupancy.supplementalFailed);
		expect(wrapper.text()).not.toContain(en.occupancy.loadFailed);
		if (failed === 'sensors') expect(wrapper.find('[data-testid="occupancy-resume"]').exists()).toBe(true);
		else {
			expect(wrapper.get('[data-testid="occupancy-observed"]').text()).toContain(en.occupancy.unknown);
			expect(wrapper.text()).toContain('Office motion');
		}
	});
	it('reports a Resume revision conflict after reloading without claiming an unconfirmed save', async () => {
		manualOverride = true;
		resumeConflict = true;
		const wrapper = render();
		await flushPromises();
		await wrapper.get('[data-testid="occupancy-resume"]').trigger('click');
		await flushPromises();
		await wrapper.vm.waitForSave();
		expect(wrapper.text()).toContain(en.occupancy.conflict);
		expect(wrapper.text()).not.toContain(en.occupancy.saveUnconfirmed);
		expect(resumeBodies).toEqual([{ data: { expected_revision: 1 } }]);
		expect(resumes).toBe(1);
		expect(manualOverride).toBe(true);
	});
	it('blocks missing sensors and invalid timing, and keeps viewers read-only', async () => {
		const wrapper = render();
		await flushPromises();
		wrapper.findComponent(ElSwitch).vm.$emit('update:modelValue', true);
		await flushPromises();
		expect(wrapper.get('[data-testid="occupancy-save"]').attributes('disabled')).toBeDefined();
		await choose(wrapper);
		wrapper.findAllComponents(ElInputNumber)[1]!.vm.$emit('update:modelValue', 1);
		await flushPromises();
		expect(wrapper.get('[data-testid="occupancy-save"]').attributes('disabled')).toBeDefined();
		harness.role = 'user';
		const viewer = render();
		await flushPromises();
		expect(viewer.get('[data-testid="occupancy-save"]').attributes('disabled')).toBeDefined();
		expect(writes).toHaveLength(0);
	});
});
