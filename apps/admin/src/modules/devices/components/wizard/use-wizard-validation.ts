import { type InjectionKey, type MaybeRefOrGetter, computed, hasInjectionContext, inject, provide, ref, toValue } from 'vue';

type FieldErrors = Record<string, string | undefined>;
interface WizardValidation {
	validate: () => boolean;
	error: (field: string) => string;
	reset: () => void;
}
const validationKey: InjectionKey<WizardValidation> = Symbol('device-wizard-validation');

/** Validate only the current step; field feedback stays reactive after the first Next click. */
export const useWizardValidation = (step: MaybeRefOrGetter<string | number>, errors: () => FieldErrors): WizardValidation => {
	const attempted = ref(new Set<string | number>());
	const fields = computed(errors);
	const validation: WizardValidation = {
		validate: () => {
			attempted.value.add(toValue(step));
			return !Object.values(fields.value).some(Boolean);
		},
		error: (field) => (attempted.value.has(toValue(step)) ? (fields.value[field] ?? '') : ''),
		reset: () => attempted.value.clear(),
	};
	if (hasInjectionContext()) provide(validationKey, validation);
	return validation;
};

/** Step components share their flow's validator without owning a separate copy of the draft. */
export const useWizardFieldError = (): WizardValidation['error'] => inject(validationKey, null)?.error ?? (() => '');
