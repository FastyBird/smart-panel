import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { AUTOMATION_IMPORT_MAX_LENGTH, AutomationReferenceKind } from '../automations.constants';
import { AutomationsGraphInvalidException, AutomationsImportInvalidException } from '../automations.exceptions';
import type { IAutomation, IAutomationGraphIssue } from '../store/automations.store.types';
import { automationTransferStoreKey, automationsStoreKey } from '../store/keys';
import type {
	IAutomationImportIssue,
	IAutomationImportMissingReference,
	IAutomationImportPreparation,
	IAutomationImportReferenceMapping,
} from '../store/transfer.store.types';

import type { IUseAutomationImport } from './types';

/** The kinds of reference the import dialog can point elsewhere; a channel on its own is fixed in the editor */
export const AUTOMATION_REMAPPABLE_REFERENCE_KINDS: readonly AutomationReferenceKind[] = [
	AutomationReferenceKind.property,
	AutomationReferenceKind.device,
	AutomationReferenceKind.scene,
	AutomationReferenceKind.space,
	AutomationReferenceKind.automation,
];

export const automationReferenceKey = (reference: Pick<IAutomationImportMissingReference, 'kind' | 'id'>): string =>
	`${reference.kind}:${reference.id}`;

/**
 * Imports an automation from a YAML file. The backend reads the file, checks it as a save would - the safety
 * policy included - and lists what it refers to that does not exist here. Each missing reference can be pointed at
 * an entity of the same kind or left as it is; the automation is then created disabled through the ordinary create
 * request, which checks it all again.
 */
export const useAutomationImport = (): IUseAutomationImport => {
	const storesManager = injectStoresManager();

	const transferStore = storesManager.getStore(automationTransferStoreKey);
	const automationsStore = storesManager.getStore(automationsStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const yaml = ref<string>('');

	const preparation = ref<IAutomationImportPreparation | null>(null);

	const fileIssues = ref<IAutomationImportIssue[]>([]);

	const graphIssues = ref<IAutomationGraphIssue[]>([]);

	// The entity each missing reference is to point at instead, by `kind:id`; left out, it stays as it is
	const mappings = ref<Record<string, string>>({});

	const submitting = ref<boolean>(false);

	const missingReferences = computed<IAutomationImportMissingReference[]>(
		(): IAutomationImportMissingReference[] => preparation.value?.missingReferences ?? []
	);

	const unresolved = computed<number>(
		(): number => missingReferences.value.filter((reference) => mappings.value[automationReferenceKey(reference)] === undefined).length
	);

	const clearProblems = (): void => {
		fileIssues.value = [];
		graphIssues.value = [];
	};

	const reset = (): void => {
		yaml.value = '';
		preparation.value = null;
		mappings.value = {};
		submitting.value = false;

		clearProblems();
	};

	const setYaml = (text: string): void => {
		yaml.value = text;

		clearProblems();
	};

	const readFile = async (file: Blob): Promise<boolean> => {
		if (file.size > AUTOMATION_IMPORT_MAX_LENGTH) {
			flashMessage.error(t('automations.transfer.messages.tooLarge', { size: AUTOMATION_IMPORT_MAX_LENGTH / 1024 }));

			return false;
		}

		try {
			setYaml(await file.text());

			return true;
		} catch {
			flashMessage.error(t('automations.transfer.messages.unreadable'));

			return false;
		}
	};

	const setMapping = (reference: Pick<IAutomationImportMissingReference, 'kind' | 'id'>, to: string | null): void => {
		const next = { ...mappings.value };

		if (to === null || to === '') {
			delete next[automationReferenceKey(reference)];
		} else {
			next[automationReferenceKey(reference)] = to;
		}

		mappings.value = next;
	};

	const mappingFor = (reference: Pick<IAutomationImportMissingReference, 'kind' | 'id'>): string | null =>
		mappings.value[automationReferenceKey(reference)] ?? null;

	const chosenMappings = (): IAutomationImportReferenceMapping[] =>
		missingReferences.value
			.filter((reference) => mappings.value[automationReferenceKey(reference)] !== undefined)
			.map((reference) => ({ kind: reference.kind, id: reference.id, to: mappings.value[automationReferenceKey(reference)] }));

	const report = (error: unknown, fallback: string): void => {
		if (error instanceof AutomationsImportInvalidException) {
			fileIssues.value = error.issues;

			flashMessage.error(t('automations.transfer.messages.invalidFile'));
		} else if (error instanceof AutomationsGraphInvalidException) {
			graphIssues.value = error.issues.filter((issue) => issue.blocking);

			flashMessage.error(t('automations.transfer.messages.invalidGraph'));
		} else {
			flashMessage.error(fallback);
		}
	};

	const prepare = async (): Promise<boolean> => {
		if (yaml.value.trim() === '' || submitting.value) {
			return false;
		}

		submitting.value = true;

		clearProblems();

		try {
			preparation.value = await transferStore.prepareImport({ yaml: yaml.value });
			mappings.value = {};

			return true;
		} catch (error: unknown) {
			report(error, t('automations.transfer.messages.notRead'));

			return false;
		} finally {
			submitting.value = false;
		}
	};

	const create = async (): Promise<IAutomation['id'] | null> => {
		if (preparation.value === null || submitting.value) {
			return null;
		}

		submitting.value = true;

		clearProblems();

		try {
			const chosen = chosenMappings();

			// The mapping is applied by the backend, which looks up the channel and device of a new property
			const { draft } = chosen.length > 0 ? await transferStore.prepareImport({ yaml: yaml.value, mappings: chosen }) : preparation.value;

			const automation = await automationsStore.add({
				data: {
					name: draft.name,
					description: draft.description,
					icon: draft.icon,
					mode: draft.mode,
					spaceId: draft.spaceId,
					enabled: false,
					graph: draft.graph,
				},
			});

			flashMessage.success(t('automations.transfer.messages.imported', { automation: automation.name }));

			return automation.id;
		} catch (error: unknown) {
			report(error, t('automations.transfer.messages.notImported'));

			return null;
		} finally {
			submitting.value = false;
		}
	};

	return {
		yaml,
		preparation,
		missingReferences,
		unresolved,
		fileIssues,
		graphIssues,
		submitting,
		setYaml,
		readFile,
		setMapping,
		mappingFor,
		prepare,
		create,
		reset,
	};
};
