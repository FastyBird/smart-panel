import { type InjectionKey, type Ref, inject, provide } from 'vue';
import { useI18n } from 'vue-i18n';

import { type SourcePlacement, groupSourcesByPlacement } from '../utils/group-sources-by-placement';

const placementKey: InjectionKey<Readonly<Ref<SourcePlacement>>> = Symbol('virtual-wizard-placement');

/** Nested source pickers share the placement of the device being created. Inline editors use no preference. */
export function provideVirtualWizardPlacement(placement: Readonly<Ref<SourcePlacement>>) {
	provide(placementKey, placement);
}

export function useVirtualWizardSourceGroups() {
	const placement = inject(placementKey, null);
	const { t } = useI18n();
	return <T>(items: T[], locate: (item: T) => SourcePlacement | null | undefined, preference = placement?.value ?? {}) =>
		groupSourcesByPlacement(items, preference, locate).map((group) => {
			let key = 'availableSources';
			if (group.id === 'room') key = 'roomSources';
			else if (group.id === 'zones') key = 'zoneSources';
			else if (preference.roomId || preference.zoneIds?.length) key = 'otherSources';
			return { ...group, label: t(`devicesVirtualPlugin.wizard.layout.${key}`) };
		});
}
