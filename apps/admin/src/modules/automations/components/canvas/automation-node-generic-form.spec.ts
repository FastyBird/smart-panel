import { ElInput, ElInputNumber, ElOption, ElSelect } from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { AutomationNodeKind } from '../../automations.constants';
import type { IAutomationNodeType } from '../../store/node-types.store.types';

import type { IAutomationNodeFormProps } from './automation-node-form.types';
import AutomationNodeGenericForm from './automation-node-generic-form.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

const nodeType = (configSchema: Record<string, unknown>): IAutomationNodeType => ({
	type: 'plugin.card',
	kind: AutomationNodeKind.action,
	name: 'A plugin card',
	description: '',
	ports: { inputs: ['in'], outputs: ['done', 'error'] },
	configSchema,
});

const schema = {
	type: 'object',
	properties: {
		title: { type: 'string', description: 'What the notification is called.' },
		seconds: { type: 'integer', minimum: 1, maximum: 3600 },
		severity: { type: 'string', enum: ['info', 'warning'] },
		to: { type: ['string', 'number', 'boolean'] },
		weekdays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } },
		writes: { type: 'array', items: { type: 'object' } },
	},
	required: ['title'],
	additionalProperties: false,
};

describe('AutomationNodeGenericForm', (): void => {
	let wrapper: VueWrapper;

	const createWrapper = async (props: Partial<IAutomationNodeFormProps> = {}): Promise<void> => {
		wrapper = mount(AutomationNodeGenericForm, {
			props: { nodeType: nodeType(schema), config: {}, ...props },
		});

		await flushPromises();
	};

	const field = (key: string): ReturnType<VueWrapper['find']> => wrapper.find(`[data-test-field="${key}"]`);

	const lastUpdate = (): unknown[] | undefined => {
		const emitted = wrapper.emitted('update:config');

		return emitted?.[emitted.length - 1];
	};

	afterEach((): void => {
		wrapper.unmount();
	});

	it('builds a field for every property of the schema', async (): Promise<void> => {
		await createWrapper();

		expect(wrapper.findAll('[data-test-field]').map((item) => item.attributes('data-test-field'))).toEqual([
			'title',
			'seconds',
			'severity',
			'to',
			'weekdays',
			'writes',
		]);
		expect(field('title').find('.el-form-item__label').text()).toBe('Title');
		expect(field('title').classes()).toContain('is-required');
		expect(field('seconds').classes()).not.toContain('is-required');
		expect(field('title').text()).toContain('What the notification is called.');
		expect(field('seconds').findComponent(ElInputNumber).props()).toMatchObject({ min: 1, max: 3600, precision: 0 });
		expect(field('writes').find('textarea').exists()).toBe(true);
	});

	it('shows the values of the configuration', async (): Promise<void> => {
		await createWrapper({ config: { title: 'Hello', seconds: 30, severity: 'warning', to: true, weekdays: [1, 2], writes: [{ value: 1 }] } });

		expect((field('title').find('input').element as HTMLInputElement).value).toBe('Hello');
		expect(field('seconds').findComponent(ElInputNumber).props('modelValue')).toBe(30);
		expect(field('severity').findComponent(ElSelect).props('modelValue')).toBe('warning');
		expect(field('to').findAllComponents(ElSelect)[0]?.props('modelValue')).toBe('boolean');
		expect(field('to').findAllComponents(ElSelect)[1]?.props('modelValue')).toBe(true);
		expect(field('weekdays').findComponent(ElSelect).props('modelValue')).toEqual([1, 2]);
		expect(JSON.parse((field('writes').find('textarea').element as HTMLTextAreaElement).value)).toEqual([{ value: 1 }]);
	});

	it('tells the configuration with the changed value and the field it was changed in', async (): Promise<void> => {
		await createWrapper({ config: { severity: 'info' } });

		await field('title').find('input').setValue('Hello');

		expect(lastUpdate()).toEqual([{ severity: 'info', title: 'Hello' }, 'title']);

		field('seconds').findComponent(ElInputNumber).vm.$emit('update:modelValue', 30);

		expect(lastUpdate()).toEqual([{ severity: 'info', seconds: 30 }, 'seconds']);
	});

	it('leaves a cleared value out of the configuration', async (): Promise<void> => {
		await createWrapper({ config: { title: 'Hello', severity: 'info', seconds: 5 } });

		field('severity').findComponent(ElSelect).vm.$emit('update:modelValue', null);

		expect(lastUpdate()).toEqual([{ title: 'Hello', seconds: 5 }, 'severity']);

		field('seconds').findComponent(ElInputNumber).vm.$emit('update:modelValue', null);

		expect(lastUpdate()).toEqual([{ title: 'Hello', severity: 'info' }, 'seconds']);
	});

	it('keeps empty text, which is a value, and unsets an optional field only when asked', async (): Promise<void> => {
		await createWrapper({ config: { title: 'Hello', to: 'on' } });

		await field('title').find('input').setValue('');

		expect(lastUpdate()).toEqual([{ title: '', to: 'on' }, 'title']);

		// A property may hold empty text: a `to` filter of '' is a restriction, not no restriction
		await field('to').findComponent(ElInput).find('input').setValue('');

		expect(lastUpdate()).toEqual([{ title: 'Hello', to: '' }, 'to']);

		await wrapper.setProps({ config: { title: 'Hello', to: '' } });

		// A required field cannot be unset; an optional one that is set can, also while it holds empty text
		expect(field('title').find('[data-test-id="unset-field"]').exists()).toBe(false);

		await field('to').find('[data-test-id="unset-field"]').trigger('click');

		expect(lastUpdate()).toEqual([{ title: 'Hello' }, 'to']);

		await wrapper.setProps({ config: { title: 'Hello', to: 'on' } });

		// Clearing an optional field unsets it
		field('to').findComponent(ElInput).vm.$emit('clear');

		expect(lastUpdate()).toEqual([{ title: 'Hello' }, 'to']);

		await wrapper.setProps({ config: { title: 'Hello' } });

		expect(field('to').find('[data-test-id="unset-field"]').exists()).toBe(false);
		expect(field('to').findComponent(ElInput).find('input').attributes('placeholder')).toBe('automations.editor.form.notSet');
	});

	it('gives options of the same text but another type keys of their own', async (): Promise<void> => {
		await createWrapper({
			nodeType: nodeType({
				type: 'object',
				properties: {
					level: { enum: [1, '1', true, 'true'] },
					levels: { type: 'array', items: { enum: [1, '1'] } },
				},
			}),
			config: { level: '1', levels: ['1'] },
		});

		for (const key of ['level', 'levels']) {
			const keys = field(key)
				.findComponent(ElSelect)
				.findAllComponents(ElOption)
				.map((option) => option.vm.$.vnode.key);

			expect(keys.length).toBeGreaterThan(1);
			expect(new Set(keys).size).toBe(keys.length);
		}
	});

	it('stores a list of numbers as numbers', async (): Promise<void> => {
		await createWrapper();

		field('weekdays').findComponent(ElSelect).vm.$emit('update:modelValue', [1, '3', 3, 'x']);

		expect(lastUpdate()).toEqual([{ weekdays: [1, 3] }, 'weekdays']);
	});

	it('stores a value as the type chosen for it', async (): Promise<void> => {
		await createWrapper({ config: { to: '50' } });

		expect(field('to').findAllComponents(ElSelect)[0]?.props('modelValue')).toBe('string');

		// Text that reads as a number is carried over when the type is changed to a number
		field('to').findAllComponents(ElSelect)[0]?.vm.$emit('update:modelValue', 'number');

		expect(lastUpdate()).toEqual([{ to: 50 }, 'to']);

		await wrapper.setProps({ config: { to: 50 } });

		expect(field('to').findComponent(ElInputNumber).props('modelValue')).toBe(50);

		// A number cannot be read as yes or no: the value is dropped and the chosen type remembered
		field('to').findAllComponents(ElSelect)[0]?.vm.$emit('update:modelValue', 'boolean');

		expect(lastUpdate()).toEqual([{}, 'to']);

		await wrapper.setProps({ config: {} });

		expect(field('to').findAllComponents(ElSelect)[0]?.props('modelValue')).toBe('boolean');

		field('to').findAllComponents(ElSelect)[1]?.vm.$emit('update:modelValue', false);

		expect(lastUpdate()).toEqual([{ to: false }, 'to']);
	});

	it('takes JSON only while it parses, and says when it does not', async (): Promise<void> => {
		await createWrapper();

		await field('writes').find('textarea').setValue('[{ "value": ');

		expect(wrapper.emitted('update:config')).toBeUndefined();
		// The form item shows a changed error after a short delay
		await vi.waitFor((): void => expect(field('writes').text()).toContain('automations.editor.form.invalidJson'));

		await field('writes').find('textarea').setValue('[{ "value": true }]');

		expect(lastUpdate()).toEqual([{ writes: [{ value: true }] }, 'writes']);
		await vi.waitFor((): void => expect(field('writes').text()).not.toContain('automations.editor.form.invalidJson'));
	});

	it('keeps JSON that parses to an empty list or null as the value typed, and unsets a field only once its text is emptied', async (): Promise<void> => {
		await createWrapper({ config: { title: 'Hello', writes: [{ value: 1 }] } });

		await field('writes').find('textarea').setValue('[]');

		expect(lastUpdate()).toEqual([{ title: 'Hello', writes: [] }, 'writes']);

		await field('writes').find('textarea').setValue('null');

		expect(lastUpdate()).toEqual([{ title: 'Hello', writes: null }, 'writes']);

		await field('writes').find('textarea').setValue('  ');

		expect(lastUpdate()).toEqual([{ title: 'Hello' }, 'writes']);
	});

	it('does not rewrite JSON being typed, but follows a change from outside', async (): Promise<void> => {
		await createWrapper();

		const typed = '[{"value":true}]';

		await field('writes').find('textarea').setValue(typed);
		await wrapper.setProps({ config: { writes: [{ value: true }] } });

		expect((field('writes').find('textarea').element as HTMLTextAreaElement).value).toBe(typed);

		// An undo brings another value
		await wrapper.setProps({ config: { writes: [{ value: false }] } });

		expect(JSON.parse((field('writes').find('textarea').element as HTMLTextAreaElement).value)).toEqual([{ value: false }]);
	});

	it('tells while a JSON field holds text that does not parse', async (): Promise<void> => {
		await createWrapper({ config: { writes: [{ value: 1 }] } });

		expect(wrapper.emitted('update:invalid')?.at(-1)).toEqual([false]);

		await field('writes').find('textarea').setValue('[{ "value": ');

		expect(wrapper.emitted('update:invalid')?.at(-1)).toEqual([true]);

		await field('writes').find('textarea').setValue('[{ "value": 2 }]');

		expect(wrapper.emitted('update:invalid')?.at(-1)).toEqual([false]);
	});

	it('replaces text that does not parse once its value is changed from outside, and only then', async (): Promise<void> => {
		await createWrapper({ config: { title: 'Hello', writes: [{ value: 1 }] } });

		const typed = '[{ "value": ';

		await field('writes').find('textarea').setValue(typed);

		// Another field changed: the text being typed stays
		await wrapper.setProps({ config: { title: 'Changed', writes: [{ value: 1 }] } });

		expect((field('writes').find('textarea').element as HTMLTextAreaElement).value).toBe(typed);
		expect(wrapper.emitted('update:invalid')?.at(-1)).toEqual([true]);

		// An undo or a reload brings another value for the field itself
		await wrapper.setProps({ config: { title: 'Changed', writes: [{ value: 3 }] } });

		expect(JSON.parse((field('writes').find('textarea').element as HTMLTextAreaElement).value)).toEqual([{ value: 3 }]);
		expect(wrapper.emitted('update:invalid')?.at(-1)).toEqual([false]);
		await vi.waitFor((): void => expect(field('writes').text()).not.toContain('automations.editor.form.invalidJson'));
	});

	it('shows what the backend refused under the field it is about', async (): Promise<void> => {
		await createWrapper({ fieldErrors: { seconds: ['The delay must be a whole number of seconds.'] } });

		expect(field('seconds').find('.el-form-item__error').text()).toBe('The delay must be a whole number of seconds.');
		expect(field('title').find('.el-form-item__error').exists()).toBe(false);
	});

	it('edits the whole configuration as JSON for a card that does not describe it', async (): Promise<void> => {
		await createWrapper({ nodeType: nodeType({ type: 'object', additionalProperties: true }), config: { answer: 42 } });

		expect(wrapper.findAll('[data-test-field]')).toHaveLength(0);
		expect(JSON.parse((wrapper.find('textarea').element as HTMLTextAreaElement).value)).toEqual({ answer: 42 });

		await wrapper.find('textarea').setValue('{ "answer": 43, "snake_key": true }');

		expect(lastUpdate()).toEqual([{ answer: 43, snake_key: true }, '']);

		// A configuration is an object: anything else is not taken
		await wrapper.find('textarea').setValue('[1, 2]');

		expect(wrapper.emitted('update:config')).toHaveLength(1);
		await vi.waitFor((): void => expect(wrapper.text()).toContain('automations.editor.form.invalidJson'));

		await wrapper.find('textarea').setValue('');

		expect(lastUpdate()).toEqual([{}, '']);
	});

	it('says so when a card has nothing to configure', async (): Promise<void> => {
		await createWrapper({ nodeType: nodeType({ type: 'object', properties: {}, additionalProperties: false }) });

		expect(wrapper.text()).toContain('automations.editor.form.nothingToConfigure');
		expect(wrapper.findComponent(ElInput).exists()).toBe(false);
	});

	it('disables every control when it is disabled', async (): Promise<void> => {
		await createWrapper({ disabled: true });

		expect(field('title').findComponent(ElInput).props('disabled')).toBe(true);
		expect(field('seconds').findComponent(ElInputNumber).props('disabled')).toBe(true);
		expect(field('severity').findComponent(ElSelect).props('disabled')).toBe(true);
	});
});
