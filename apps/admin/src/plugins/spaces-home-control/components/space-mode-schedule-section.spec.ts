import { computed } from 'vue';
import { createI18n } from 'vue-i18n';

import { ElDialog, ElSelect, ElSwitch } from 'element-plus';
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

import SpaceModeScheduleSection from './SpaceModeScheduleSection.vue';

const harness = vi.hoisted(() => ({ client: null as unknown, role: 'owner' }));
vi.mock('../../../common', () => ({ useBackend: () => ({ client: harness.client }) }));
vi.mock('../../../modules/auth/composables/useSession', () => ({ useSession: () => ({ profile: computed(() => ({ role: harness.role })) }) }));
const locales = { 'en-US': en, 'cs-CZ': cs, 'sk-SK': sk, 'de-DE': de, 'es-ES': es, 'pl-PL': pl };
const row = (space = 'space', revision = 1) => ({
	id: 'schedule',
	space_id: space,
	created_at: '2026-11-02T00:00:00Z',
	revision,
	enabled: false,
	timezone: null,
	entries: [],
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });
let writes: Record<string, unknown>[];
let conflict: boolean;
let hold: Promise<void> | null;
let wrappers: ReturnType<typeof mount>[];
const render = (locale: keyof typeof locales = 'en-US') => {
	const wrapper = mount(SpaceModeScheduleSection, {
		props: { spaceId: 'space' },
		global: {
			plugins: [createI18n({ legacy: false, locale, messages: { [locale]: { spacesHomeControlPlugin: locales[locale] } } })],
			stubs: { teleport: false },
		},
		attachTo: document.body,
	});
	wrappers.push(wrapper);
	return wrapper;
};
beforeEach(() => {
	writes = [];
	conflict = false;
	hold = null;
	wrappers = [];
	harness.role = 'owner';
	harness.client = createClient<paths>({
		baseUrl: 'http://localhost/api/v1',
		fetch: async (request: Request) => {
			const space = new URL(request.url).pathname.split('/').at(-2)!;
			if (request.method === 'PUT') {
				const body = await request.json();
				writes.push(body.data);
				if (hold) await hold;
				return conflict ? json(null, 409) : json({ ...row(space, 2), ...body.data });
			}
			return json(row(space, conflict ? 2 : 1));
		},
	});
});
afterEach(() => {
	for (const wrapper of wrappers) wrapper.unmount();
	document.body.innerHTML = '';
});
const addEntry = async (wrapper: ReturnType<typeof render>) => {
	await wrapper.get('[data-testid="schedule-add"]').trigger('click');
	await flushPromises();
	await wrapper.get('input[data-testid="schedule-entry-time"]').setValue('19:30');
	wrapper
		.findAllComponents(ElSelect)
		.find((select) => select.attributes('data-testid') === 'schedule-pattern')!
		.vm.$emit('update:modelValue', 'weekend');
	await flushPromises();
	await wrapper.get('[data-testid="schedule-entry-apply"]').trigger('click');
	await flushPromises();
};
describe('weekly scheduling editor with the actual API client', () => {
	it.each(Object.keys(locales) as (keyof typeof locales)[])('renders real %s labels without initialization writes', async (locale) => {
		const wrapper = render(locale);
		await flushPromises();
		expect(wrapper.text()).toContain(locales[locale].schedules.title);
		expect(wrapper.get('table').attributes('aria-label')).toBe(locales[locale].schedules.weeklyView);
		expect(wrapper.findAll('th')).toHaveLength(7);
		expect(writes).toHaveLength(0);
	});
	it('adds and edits a weekend entry locally, then saves once with the original revision', async () => {
		const wrapper = render();
		await flushPromises();
		await addEntry(wrapper);
		expect(writes).toHaveLength(0);
		expect(wrapper.findAll('tbody li')).toHaveLength(2);
		await wrapper.get('[data-testid="schedule-save"]').trigger('click');
		await flushPromises();
		expect(writes).toEqual([
			expect.objectContaining({
				expected_revision: 1,
				timezone: null,
				enabled: false,
				entries: [expect.objectContaining({ time: '19:30', days_of_week: [0, 6], enabled: true })],
			}),
		]);
		await wrapper.get('tbody li button').trigger('click');
		await flushPromises();
		await wrapper.get('[data-testid="schedule-entry-delete"]').trigger('click');
		await flushPromises();
		await wrapper.get('[data-testid="schedule-save"]').trigger('click');
		await flushPromises();
		expect(writes[1]).toMatchObject({ expected_revision: 2, entries: [] });
	});
	it('counts new and changed entries as unsaved, but not an unchanged open entry', async () => {
		const wrapper = render();
		await flushPromises();
		expect(wrapper.vm.hasUnsavedChanges).toBe(false);
		await wrapper.get('[data-testid="schedule-add"]').trigger('click');
		expect(wrapper.vm.hasUnsavedChanges).toBe(true);
		await wrapper.get('[data-testid="schedule-entry-apply"]').trigger('click');
		await wrapper.get('[data-testid="schedule-save"]').trigger('click');
		await flushPromises();
		expect(wrapper.vm.hasUnsavedChanges).toBe(false);
		await wrapper.get('tbody li button').trigger('click');
		await flushPromises();
		expect(wrapper.vm.hasUnsavedChanges).toBe(false);
		await wrapper.get('input[data-testid="schedule-entry-time"]').setValue('09:30');
		expect(wrapper.vm.hasUnsavedChanges).toBe(true);
		await wrapper.get('input[data-testid="schedule-entry-time"]').setValue('08:00');
		expect(wrapper.vm.hasUnsavedChanges).toBe(false);
		wrapper.findComponent(ElSwitch).vm.$emit('update:modelValue', true);
		await flushPromises();
		expect(wrapper.vm.hasUnsavedChanges).toBe(true);
	});
	it('preserves a conflicting draft until explicit discard and never retries a write', async () => {
		const wrapper = render();
		await flushPromises();
		await addEntry(wrapper);
		conflict = true;
		await wrapper.get('[data-testid="schedule-save"]').trigger('click');
		await flushPromises();
		expect(writes).toHaveLength(1);
		expect(wrapper.findAll('tbody li')).toHaveLength(2);
		expect(wrapper.text()).toContain(en.schedules.conflictHelp);
		expect(wrapper.get('[data-testid="schedule-save"]').attributes('disabled')).toBeDefined();
		await wrapper.get('[data-testid="schedule-refresh"]').trigger('click');
		await flushPromises();
		expect(wrapper.findAll('tbody li')).toHaveLength(2);
		expect(wrapper.get('[data-testid="schedule-save"]').attributes('disabled')).toBeDefined();
		await wrapper.get('[data-testid="schedule-save"]').trigger('click');
		expect(writes).toHaveLength(1);
		await wrapper.get('[data-testid="schedule-discard"]').trigger('click');
		await flushPromises();
		expect(wrapper.findAll('tbody li')).toHaveLength(0);
		conflict = false;
		await addEntry(wrapper);
		await wrapper.get('[data-testid="schedule-save"]').trigger('click');
		await flushPromises();
		expect(writes).toHaveLength(2);
		expect(writes[1]).toMatchObject({ expected_revision: 2 });
	});
	it('does not let an old save replace the next space', async () => {
		const wrapper = render();
		await flushPromises();
		await addEntry(wrapper);
		let release!: () => void;
		hold = new Promise<void>((resolve) => {
			release = resolve;
		});
		await wrapper.get('[data-testid="schedule-save"]').trigger('click');
		await flushPromises();
		await wrapper.setProps({ spaceId: 'other' });
		await flushPromises();
		release();
		await flushPromises();
		expect(wrapper.findAll('tbody li')).toHaveLength(0);
		expect(writes).toHaveLength(1);
	});
	it('keeps viewers read-only and prevents invalid timezone saves', async () => {
		harness.role = 'user';
		const viewer = render();
		await flushPromises();
		expect(viewer.get('[data-testid="schedule-add"]').attributes('disabled')).toBeDefined();
		harness.role = 'owner';
		const owner = render();
		await flushPromises();
		owner.findComponent(ElSwitch).vm.$emit('update:modelValue', true);
		owner
			.findAllComponents(ElSelect)
			.find((select) => select.attributes('data-testid') === 'schedule-timezone')!
			.vm.$emit('update:modelValue', 'Invalid/Timezone');
		await flushPromises();
		expect(owner.get('[data-testid="schedule-save"]').attributes('disabled')).toBeDefined();
		expect(writes).toHaveLength(0);
		expect(owner.findComponent(ElDialog).props('modelValue')).toBe(false);
	});
});
