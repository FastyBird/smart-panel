import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { storeToRefs } from 'pinia';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { AutomationMode } from '../automations.constants';
import { takeAutomationDraft } from '../automations.drafts';
import { AutomationsApiException, AutomationsGraphInvalidException, AutomationsRevisionConflictException } from '../automations.exceptions';
import { canonicalGraph, cloneGraph, createEmptyGraph, findSeparateFlows, pruneIssues } from '../automations.graph';
import { AUTOMATION_SAFETY_ISSUE_CODE } from '../nodes/nodes.constants';
import type { IAutomation, IAutomationGraph, IAutomationGraphIssue, IAutomationGraphNode } from '../store/automations.store.types';
import { automationNodeTypesStoreKey, automationsStoreKey } from '../store/keys';

import type { AutomationEditorSaveResult, IUseAutomationEditor } from './types';
import { useAutomationGraphHistory } from './useAutomationGraphHistory';

interface IUseAutomationEditorProps {
	id: IAutomation['id'];
}

/**
 * The working copy of an automation's flow: the graph being drawn, its undo history, what the backend
 * found wrong with it, and saving it against the revision it was read at.
 *
 * Nothing drawn is ever thrown away without the user saying so. A save that is refused - because the
 * graph is not valid, or because the automation was changed elsewhere in the meantime - leaves the working
 * copy as it is; after a conflict the user chooses between their copy and the one on the backend.
 */
export const useAutomationEditor = ({ id }: IUseAutomationEditorProps): IUseAutomationEditor => {
	const storesManager = injectStoresManager();

	const automationsStore = storesManager.getStore(automationsStoreKey);
	const nodeTypesStore = storesManager.getStore(automationNodeTypesStoreKey);

	const { data } = storeToRefs(automationsStore);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const history = useAutomationGraphHistory();

	const automation = computed<IAutomation | null>((): IAutomation | null => data.value.get(id) ?? null);

	// The revision the working copy is based on, and the graph as it was saved at that revision
	const baseRevision = ref<number | null>(null);
	const savedGraph = ref<string>(canonicalGraph(createEmptyGraph()));

	const issues = ref<IAutomationGraphIssue[]>([]);

	const loaded = ref<boolean>(false);
	const saving = ref<boolean>(false);
	const reloading = ref<boolean>(false);
	const conflict = ref<boolean>(false);

	// The open form holds text that does not parse: it has not reached the graph, yet it is as unsaved as
	// anything drawn. Each time it is given up the count moves, so the form is rebuilt from the graph.
	const draftInvalid = ref<boolean>(false);
	const draftResets = ref<number>(0);

	const isDirty = computed<boolean>((): boolean => loaded.value && canonicalGraph(history.graph.value) !== savedGraph.value);

	const hasUnsaved = computed<boolean>((): boolean => isDirty.value || draftInvalid.value);

	// Under `restart` a trigger of one flow cancels the runs of every other flow on the canvas (ADR 0003,
	// decision 2), so unrelated flows belong to separate automations
	const hasSeparateFlows = computed<boolean>(
		(): boolean => automation.value?.mode === AutomationMode.restart && findSeparateFlows(history.graph.value, nodeTypesStore.findByType).length > 1
	);

	const discardDraft = (): void => {
		if (draftInvalid.value) {
			draftInvalid.value = false;
			draftResets.value += 1;
		}
	};

	const adopt = (source: IAutomation): void => {
		const graph = source.graph ? cloneGraph(source.graph) : createEmptyGraph();

		baseRevision.value = source.revision;
		savedGraph.value = canonicalGraph(graph);
		issues.value = [];
		conflict.value = false;

		discardDraft();

		history.reset(graph);
	};

	const setDraftInvalid = (invalid: boolean): void => {
		draftInvalid.value = invalid;
	};

	// A read on its own always brings the graph, yet it answers with the newest record held: a list read at a
	// later revision that overtook it brings that revision without its graph. That is not an empty flow, so
	// the automation is read again until the revision held comes with its graph.
	const readWithGraph = async (fresh: boolean): Promise<IAutomation> => {
		let fetched = await automationsStore.get({ id, fresh });

		for (let attempt = 0; fetched.graph === null && attempt < 2; attempt++) {
			fetched = await automationsStore.get({ id, fresh: true });
		}

		if (fetched.graph === null) {
			throw new AutomationsApiException('Failed to read the automation graph.');
		}

		return fetched;
	};

	const load = async (): Promise<void> => {
		// Always read on its own: only that response carries the graph, and the list may hold an older revision
		const fetched = await readWithGraph(false);

		adopt(fetched);

		// An automation just created from a template opens with the flow the template generated: it is the
		// working copy, not yet saved, and undo goes back to the empty flow that was created
		const draft = takeAutomationDraft(id);

		if (draft !== null && history.graph.value.nodes.length === 0) {
			history.commit(cloneGraph(draft.graph));
		}

		loaded.value = true;
	};

	const updateGraph = (graph: IAutomationGraph, coalesceKey?: string): void => {
		if (history.commit(graph, coalesceKey)) {
			issues.value = pruneIssues(issues.value, history.graph.value);
		}
	};

	const updateNodeConfig = (nodeId: IAutomationGraphNode['id'], config: IAutomationGraphNode['config'], field?: string): void => {
		const graph = history.graph.value;

		updateGraph(
			{
				...graph,
				nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, config } : node)),
			},
			`config:${nodeId}:${field ?? ''}`
		);

		// A part of the configuration replaced as a whole - an entry added to a list or removed from it: what
		// the backend said about what is under it names entries by their place, which now holds another one
		if (typeof field === 'string' && field !== '') {
			issues.value = issues.value.filter((issue) => issue.node_id !== nodeId || !issue.field?.startsWith(`${field}.`));
		}
	};

	const undo = (): void => {
		if (history.undo()) {
			issues.value = pruneIssues(issues.value, history.graph.value);
		}
	};

	const redo = (): void => {
		if (history.redo()) {
			issues.value = pruneIssues(issues.value, history.graph.value);
		}
	};

	const name = (): string => automation.value?.name ?? '';

	// A save refused because an action would unlock, disarm or open says so: it is not something left
	// unfinished, and no other change makes it savable
	const flashInvalid = (refused: IAutomationGraphIssue[]): void => {
		const unsafe = refused.some((issue) => issue.code === AUTOMATION_SAFETY_ISSUE_CODE && issue.severity === 'error');

		flashMessage.error(t(unsafe ? 'automations.editor.messages.unsafe' : 'automations.editor.messages.invalid', { automation: name() }));
	};

	const handleSaveError = (error: unknown): AutomationEditorSaveResult => {
		if (error instanceof AutomationsRevisionConflictException) {
			conflict.value = true;

			flashMessage.warning(t('automations.editor.messages.conflict', { automation: name() }));

			return 'conflict';
		}

		if (error instanceof AutomationsGraphInvalidException) {
			issues.value = pruneIssues(error.issues, history.graph.value);

			flashInvalid(error.issues);

			return 'invalid';
		}

		flashMessage.error(t('automations.messages.notEdited', { automation: name() }));

		return 'error';
	};

	// Sends the working copy; the caller holds `saving`
	const persist = async (): Promise<AutomationEditorSaveResult> => {
		if (baseRevision.value === null || automation.value === null) {
			return 'error';
		}

		const graph = cloneGraph(history.graph.value);

		try {
			// Asked first because it also names what would not stop the save, such as a block no trigger
			// leads to. When the question itself fails the save still answers for what is blocking.
			const validation = await automationsStore.validate({ graph, enabled: automation.value.enabled }).catch((): null => null);

			if (validation !== null) {
				issues.value = pruneIssues(validation.issues, history.graph.value);

				if (!validation.valid) {
					flashInvalid(validation.issues);

					return 'invalid';
				}
			}

			const saved = await automationsStore.edit({ id, revision: baseRevision.value, data: { graph } });

			baseRevision.value = saved.revision;
			// Compared against what was sent: what was drawn while the save was under way is still unsaved
			savedGraph.value = canonicalGraph(graph);
			conflict.value = false;

			flashMessage.success(t('automations.messages.edited', { automation: saved.name }));

			return 'saved';
		} catch (error: unknown) {
			return handleSaveError(error);
		}
	};

	const save = async (): Promise<AutomationEditorSaveResult> => {
		if (saving.value) {
			return 'error';
		}

		saving.value = true;

		let result: AutomationEditorSaveResult;

		try {
			result = await persist();
		} finally {
			saving.value = false;
		}

		if (result === 'saved') {
			followNewer();
		}

		return result;
	};

	const setEnabled = async (enabled: boolean): Promise<boolean> => {
		if (saving.value || baseRevision.value === null) {
			return false;
		}

		saving.value = true;

		let saved: IAutomation;

		try {
			saved = await automationsStore.edit({ id, revision: baseRevision.value, data: { enabled } });

			baseRevision.value = saved.revision;
		} catch (error: unknown) {
			if (error instanceof AutomationsGraphInvalidException) {
				issues.value = pruneIssues(error.issues, history.graph.value);

				flashMessage.error(t('automations.messages.notEnabledIncomplete', { automation: name() }));
			} else if (error instanceof AutomationsRevisionConflictException) {
				handleSaveError(error);
			} else {
				flashMessage.error(t(enabled ? 'automations.messages.notEnabled' : 'automations.messages.notDisabled', { automation: name() }));
			}

			return false;
		} finally {
			saving.value = false;
		}

		flashMessage.success(t(enabled ? 'automations.messages.enabled' : 'automations.messages.disabled', { automation: saved.name }));

		followNewer();

		return true;
	};

	/**
	 * After a conflict: gives up the working copy for what the backend holds now.
	 */
	const reloadLatest = async (): Promise<void> => {
		if (saving.value) {
			return;
		}

		// Every edit, undo and redo puts a new graph in place, so the one shown now tells whether anything
		// was drawn while the read was on its way
		const drawing = history.graph.value;

		// Nothing is saved while the read is on its way: what it brings replaces the revision a save is based on
		saving.value = true;
		reloading.value = true;

		try {
			// What is on its way may be from before the other save, so it is read anew
			const latest = await readWithGraph(true);

			if (history.graph.value !== drawing) {
				// Drawn after the user gave up their copy or after the editor set out to follow a save made
				// elsewhere: that is not thrown away, the user chooses again
				conflict.value = true;

				return;
			}

			adopt(latest);
		} finally {
			saving.value = false;
			reloading.value = false;
		}
	};

	/**
	 * After a conflict: saves the working copy over what the backend holds now.
	 */
	const overwrite = async (): Promise<AutomationEditorSaveResult> => {
		// A read or a save already under way would move the revision this one is based on
		if (saving.value) {
			flashMessage.warning(t('automations.editor.messages.busy'));

			return 'error';
		}

		saving.value = true;

		let result: AutomationEditorSaveResult;

		try {
			// Based on a read from before the other save, the overwrite would only be refused again
			const latest = await automationsStore.get({ id, fresh: true });

			baseRevision.value = latest.revision;

			result = await persist();
		} catch (error: unknown) {
			result = handleSaveError(error);
		} finally {
			saving.value = false;
		}

		if (result === 'saved') {
			followNewer();
		}

		return result;
	};

	// The automation was saved elsewhere while the editor is open. With nothing drawn or typed since the last
	// save the editor simply follows; otherwise the working copy is kept and the user is told. A save made
	// elsewhere whose event got here while this editor was saving is only seen once its own save is done.
	const followNewer = (): void => {
		const revision = automation.value?.revision;

		if (!loaded.value || saving.value || typeof revision === 'undefined' || baseRevision.value === null || revision <= baseRevision.value) {
			return;
		}

		if (hasUnsaved.value) {
			conflict.value = true;

			return;
		}

		reloadLatest().catch((): void => {
			// Still on the revision read before; a save will report the conflict
		});
	};

	watch((): number | undefined => automation.value?.revision, followNewer);

	return {
		automation,
		graph: history.graph,
		issues,
		loaded,
		saving,
		reloading,
		conflict,
		isDirty,
		draftInvalid,
		draftResets,
		hasUnsaved,
		hasSeparateFlows,
		canUndo: history.canUndo,
		canRedo: history.canRedo,
		load,
		updateGraph,
		updateNodeConfig,
		setDraftInvalid,
		discardDraft,
		undo,
		redo,
		save,
		setEnabled,
		reloadLatest,
		overwrite,
	};
};
