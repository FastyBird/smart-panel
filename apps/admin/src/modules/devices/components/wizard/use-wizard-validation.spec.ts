import { reactive, ref } from 'vue';

import { describe, expect, it } from 'vitest';

import { useWizardValidation } from './use-wizard-validation';

describe('wizard field validation', () => {
	it('reveals current step errors on Next and clears them as fields are corrected', () => {
		const step = ref(0);
		const draft = reactive({ name: '', source: '' });
		const validation = useWizardValidation(step, () =>
			step.value === 0 ? { name: draft.name.trim() ? undefined : 'Name required' } : { source: draft.source ? undefined : 'Source required' }
		);
		expect(validation.error('name')).toBe('');
		expect(validation.validate()).toBe(false);
		expect(validation.error('name')).toBe('Name required');
		draft.name = 'Sensor';
		expect(validation.error('name')).toBe('');
		expect(validation.validate()).toBe(true);
		step.value = 1;
		expect(validation.error('source')).toBe('');
		expect(validation.validate()).toBe(false);
		expect(validation.error('source')).toBe('Source required');
		draft.source = 'offline-sensor';
		expect(validation.validate()).toBe(true);
	});
});
