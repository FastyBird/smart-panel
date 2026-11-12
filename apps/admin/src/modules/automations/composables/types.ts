import type { Component, ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';
import { type ZodType, z } from 'zod';

import type { IModuleElement, IPluginElement } from '../../../common';
import type { ISpace } from '../../spaces/store/spaces.store.types';
import type {
	AutomationMode,
	AutomationNodeKind,
	AutomationRunRecordStatus,
	AutomationTriggerOutcome,
	AutomationTriggerRefusal,
	FormResultType,
} from '../automations.constants';
import type { IAutomationRunAttention, IAutomationRunNodeOverlay, IAutomationRunOverlay } from '../automations.trace';
import type { IAutomationNodePluginsComponents, IAutomationNodePluginsSchemas } from '../automations.types';
import type { IAutomationNodeLookups } from '../nodes/nodes.summaries';
import type { IAutomationAddForm, IAutomationEditForm } from '../schemas/automations.types';
import type { IAutomation, IAutomationGraph, IAutomationGraphIssue, IAutomationGraphNode } from '../store/automations.store.types';
import type { IAutomationNodeType } from '../store/node-types.store.types';
import type {
	IAutomationRun,
	IAutomationRunStep,
	IAutomationRuntime,
	IAutomationRuntimeProblem,
	IAutomationTriggerResult,
} from '../store/runs.store.types';

import { AutomationsFilterSchema } from './schemas';

export type IAutomationsFilter = z.infer<typeof AutomationsFilterSchema>;

export type AutomationsSortBy = 'name' | 'status' | 'lastTriggeredAt';

export interface ISpaceOption {
	value: ISpace['id'];
	label: string;
	icon: string;
}

export interface IModeOption {
	value: AutomationMode;
	label: string;
	description: string;
}

export interface IUseAutomation {
	automation: ComputedRef<IAutomation | null>;
	isLoading: ComputedRef<boolean>;
	fetchAutomation: () => Promise<void>;
}

export interface IUseAutomations {
	automations: ComputedRef<IAutomation[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchAutomations: () => Promise<void>;
}

export interface IUseAutomationsDataSource {
	automations: ComputedRef<IAutomation[]>;
	automationsPaginated: ComputedRef<IAutomation[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	loadFailed: ComputedRef<boolean>;
	fetchAutomations: () => Promise<void>;
	filters: Ref<IAutomationsFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<AutomationsSortBy | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
	resetFilter: () => void;
}

export interface IUseAutomationsActions {
	updating: ComputedRef<IAutomation['id'][]>;
	remove: (id: IAutomation['id']) => Promise<void>;
	setEnabled: (id: IAutomation['id'], enabled: boolean) => Promise<boolean>;
}

export interface IUseAutomationSpaces {
	spacesOptions: ComputedRef<ISpaceOption[]>;
	loadingSpaces: ComputedRef<boolean>;
	fetchSpaces: () => Promise<void>;
	getSpaceName: (id: ISpace['id'] | null) => string | null;
}

export interface IUseAutomationAddForm {
	modeOptions: ComputedRef<IModeOption[]>;
	model: Reactive<IAutomationAddForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseAutomationEditForm {
	modeOptions: ComputedRef<IModeOption[]>;
	model: Reactive<IAutomationEditForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseAutomationNodeTypes {
	nodeTypes: ComputedRef<IAutomationNodeType[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchNodeTypes: () => Promise<void>;
	getNodeType: (type: IAutomationNodeType['type']) => IAutomationNodeType | null;
}

export interface IUseAutomationNodePresentation {
	issueText: (issue: Pick<IAutomationGraphIssue, 'code' | 'message'>) => string;
	kindLabel: (kind: AutomationNodeKind | null) => string;
	kindTitle: (kind: AutomationNodeKind) => string;
	nodeTitle: (type: IAutomationGraphNode['type'], nodeType: IAutomationNodeType | null) => string;
	nodeDescription: (type: IAutomationGraphNode['type'], nodeType: IAutomationNodeType | null) => string;
	nodeIcon: (type: IAutomationGraphNode['type'], nodeType: IAutomationNodeType | null) => string;
	nodeSummary: (node: Pick<IAutomationGraphNode, 'type' | 'config'>, nodeType: IAutomationNodeType | null) => string;
	portLabel: (port: string) => string;
}

export interface IUseAutomationGraphHistory {
	graph: Ref<IAutomationGraph>;
	canUndo: ComputedRef<boolean>;
	canRedo: ComputedRef<boolean>;
	// Returns whether anything changed. Commits sharing a `coalesceKey` in quick succession are one step.
	commit: (graph: IAutomationGraph, coalesceKey?: string) => boolean;
	undo: () => boolean;
	redo: () => boolean;
	reset: (graph: IAutomationGraph) => void;
}

export type AutomationEditorSaveResult = 'saved' | 'invalid' | 'conflict' | 'error';

export interface IUseAutomationEditor {
	automation: ComputedRef<IAutomation | null>;
	graph: Ref<IAutomationGraph>;
	issues: Ref<IAutomationGraphIssue[]>;
	loaded: Ref<boolean>;
	// A save, or a read of the saved version that is to replace the working copy, is under way
	saving: Ref<boolean>;
	// The saved version is being read to replace the working copy: nothing may be typed meanwhile
	reloading: Ref<boolean>;
	// The automation was changed elsewhere since the working copy was read
	conflict: Ref<boolean>;
	isDirty: ComputedRef<boolean>;
	// The open form holds text that does not parse, so it has not reached the graph
	draftInvalid: Ref<boolean>;
	// Moves each time such text is given up: the form is to be rebuilt from the graph
	draftResets: Ref<number>;
	// What is drawn or typed and not saved
	hasUnsaved: ComputedRef<boolean>;
	hasSeparateFlows: ComputedRef<boolean>;
	canUndo: ComputedRef<boolean>;
	canRedo: ComputedRef<boolean>;
	load: () => Promise<void>;
	updateGraph: (graph: IAutomationGraph, coalesceKey?: string) => void;
	updateNodeConfig: (nodeId: IAutomationGraphNode['id'], config: IAutomationGraphNode['config'], field?: string) => void;
	setDraftInvalid: (invalid: boolean) => void;
	// Gives up text in the form that does not parse, which rebuilds the form from the graph
	discardDraft: () => void;
	undo: () => void;
	redo: () => void;
	save: () => Promise<AutomationEditorSaveResult>;
	setEnabled: (enabled: boolean) => Promise<boolean>;
	reloadLatest: () => Promise<void>;
	overwrite: () => Promise<AutomationEditorSaveResult>;
}

export type IAutomationNodeElement =
	| IPluginElement<IAutomationNodePluginsComponents, IAutomationNodePluginsSchemas>
	| IModuleElement<IAutomationNodePluginsComponents, IAutomationNodePluginsSchemas>;

export interface IUseAutomationNodePlugins {
	// The element of every card that has one, by node type; what a plugin leaves out is filled in from the module
	elements: ComputedRef<Map<string, IAutomationNodeElement>>;
	getElement: (type: string) => IAutomationNodeElement | undefined;
	getFormComponent: (type: string) => Component | null;
	getCardComponent: (type: string) => Component | null;
	getConfigSchema: (type: string) => ZodType | null;
}

export interface IUseAutomationNodeForm {
	// Sets the fields given, leaving the others; `field` names what was edited, for the undo history
	update: (patch: Record<string, unknown>, field: string) => void;
	// The problems of a field and of its parts (`writes` covers `writes.0.value`), worded
	errorsAt: (path: string) => string[];
	errorText: (path: string) => string | undefined;
	warningsAt: (path: string) => IAutomationGraphIssue[];
	// What the backend refused because it would reduce safety
	refusalsAt: (path: string) => IAutomationGraphIssue[];
}

export interface IUseAutomationNodeLookups extends IAutomationNodeLookups {
	// Reads the devices (with their channels and properties) once, unless they are read already
	ensureDevices: () => Promise<void>;
	// Reads the scenes once, unless they are read already
	ensureScenes: () => Promise<void>;
}

export interface IUseAutomationLiveRun {
	// The backend sends the steps of the automation's runs to this client
	watching: Ref<boolean>;
	// The run a step arrived for last
	latestRunId: Ref<string | null>;
	// The steps of a run received so far, in order
	stepsOf: (runId: string) => IAutomationRunStep[];
}

// `live`: a run followed as it happens (started with Test, or by a trigger while the view is open);
// `replay`: a run picked from the history
export type AutomationRunOverlaySource = 'live' | 'replay';

export interface IAutomationShownRun {
	runId: string;
	source: AutomationRunOverlaySource;
	// The record of the run; null while the backend has not announced it yet
	run: IAutomationRun | null;
	// The steps known so far: the stored trace and what the live view received
	steps: IAutomationRunStep[];
	overlay: IAutomationRunOverlay;
	// The run is over: its status is not `running`
	ended: boolean;
	// What needs explaining about how it ended, and the card it is about
	attention: IAutomationRunAttention | null;
	// The stored trace is being read, or could not be read
	loading: boolean;
	failed: boolean;
	// The trace was shortened by the backend to fit its size limit
	truncated: boolean;
}

export interface IUseAutomationRunTrace {
	runs: ComputedRef<IAutomationRun[]>;
	runsLoading: ComputedRef<boolean>;
	runsLoadFailed: Ref<boolean>;
	runtime: ComputedRef<IAutomationRuntime | null>;
	testing: ComputedRef<boolean>;
	watching: Ref<boolean>;
	// The run laid over the canvas; null when none is
	shown: ComputedRef<IAutomationShownRun | null>;
	fetchRuns: () => Promise<void>;
	fetchRuntime: () => Promise<void>;
	// Starts a run by hand, at the trigger given or the first one, and follows it on the canvas
	test: (nodeId?: string) => Promise<IAutomationTriggerResult>;
	replay: (runId: string) => void;
	close: () => void;
}

export interface IUseAutomationRunPresentation {
	runStatusLabel: (status: AutomationRunRecordStatus) => string;
	durationText: (ms: number) => string;
	dateText: (date: Date) => string;
	// The line a card shows about what it did in the run
	nodeRunText: (overlay: IAutomationRunNodeOverlay, ended: boolean) => string;
	// What happened to a run that did not complete, in plain words
	attentionText: (attention: IAutomationRunAttention) => string;
	// Why an invalid automation cannot run, in plain words
	problemText: (problem: Pick<IAutomationRuntimeProblem, 'code' | 'message'>) => string;
	refusalText: (refusal: AutomationTriggerRefusal | null) => string;
	outcomeText: (outcome: AutomationTriggerOutcome) => string;
	nodeLabel: (nodeId: string, graph: Pick<IAutomationGraph, 'nodes'>, nodeTypes: IAutomationNodeType[]) => string | null;
}
