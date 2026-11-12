import { reactive } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { DevicePropertySetConfigSchema, TimeWindowConfigSchema } from '../nodes/nodes.schemas';
import type { IAutomationGraphIssue } from '../store/automations.store.types';

import { useAutomationNodeForm } from './useAutomationNodeForm';

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => `t:${key}`,
		te: () => false,
	}),
}));

const issue = (overrides: Partial<IAutomationGraphIssue>): IAutomationGraphIssue => ({
	severity: 'error',
	code: 'invalid_config',
	message: 'Not valid.',
	blocking: true,
	node_id: 'n1',
	...overrides,
});

const setup = (config: Record<string, unknown>, issues: IAutomationGraphIssue[] = [], fieldErrors: Record<string, string[]> = {}) => {
	const emit = vi.fn();
	const props = reactive({ config, issues, fieldErrors });

	return { emit, props, form: useAutomationNodeForm(props, emit, TimeWindowConfigSchema) };
};

describe('useAutomationNodeForm', (): void => {
	it('sets several fields at once and leaves out what was cleared', (): void => {
		const { emit, form } = setup({ from: '22:00', to: '06:00', weekdays: [1] });

		form.update({ to: '07:00', weekdays: undefined }, 'to');

		expect(emit).toHaveBeenCalledWith('update:config', { from: '22:00', to: '07:00' }, 'to');
	});

	it('shows what the schema finds at once, translated', (): void => {
		const { form } = setup({ from: '22:00', to: '22:00' });

		expect(form.errorsAt('to')).toEqual(['t:automations.editor.validation.windowEmpty']);
		expect(form.errorText('from')).toBeUndefined();
	});

	it('shows what the backend reported for a field and its parts, worded by the backend', (): void => {
		const { form } = setup({ from: '08:00', to: '09:00' }, [
			issue({ field: 'weekdays.0', message: 'A weekday is a number from 0 (Sunday) to 6.' }),
			issue({ field: 'to', severity: 'warning', message: 'Only a warning.' }),
		]);

		expect(form.errorsAt('weekdays')).toEqual(['A weekday is a number from 0 (Sunday) to 6.']);
		expect(form.errorsAt('to')).toEqual([]);
		expect(form.warningsAt('to')).toHaveLength(1);
	});

	it('takes the errors by key from a host that hands over no issues', (): void => {
		const { form } = setup({ from: '08:00', to: '09:00' }, [], { from: ['Refused.'] });

		expect(form.errorsAt('from')).toEqual(['Refused.']);
	});

	it('keeps the refusal of an unsafe write apart from the field errors', (): void => {
		const emit = vi.fn();
		const refusal = issue({ code: 'safety_reducing_action', field: 'writes.0.value', message: 'An automation can not unlock a lock.' });
		const props = reactive({ config: { writes: [] }, issues: [refusal], fieldErrors: {} });
		const form = useAutomationNodeForm(props, emit, DevicePropertySetConfigSchema);

		expect(form.errorsAt('writes.0.value')).toEqual([]);
		expect(form.refusalsAt('writes.0')).toEqual([refusal]);
		expect(form.refusalsAt('writes.1')).toEqual([]);
	});
});
