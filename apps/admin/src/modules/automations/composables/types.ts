import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';
import { z } from 'zod';

import type { ISpace } from '../../spaces/store/spaces.store.types';
import type { AutomationMode, AutomationNodeKind, FormResultType } from '../automations.constants';
import type { IAutomationAddForm, IAutomationEditForm } from '../schemas/automations.types';
import type { IAutomation, IAutomationGraph, IAutomationGraphIssue, IAutomationGraphNode } from '../store/automations.store.types';
import type { IAutomationNodeType } from '../store/node-types.store.types';

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
	// The automation was changed elsewhere since the working copy was read
	conflict: Ref<boolean>;
	isDirty: ComputedRef<boolean>;
	hasSeparateFlows: ComputedRef<boolean>;
	canUndo: ComputedRef<boolean>;
	canRedo: ComputedRef<boolean>;
	load: () => Promise<void>;
	updateGraph: (graph: IAutomationGraph, coalesceKey?: string) => void;
	updateNodeConfig: (nodeId: IAutomationGraphNode['id'], config: IAutomationGraphNode['config'], field?: string) => void;
	undo: () => void;
	redo: () => void;
	save: () => Promise<AutomationEditorSaveResult>;
	setEnabled: (enabled: boolean) => Promise<boolean>;
	reloadLatest: () => Promise<void>;
	overwrite: () => Promise<AutomationEditorSaveResult>;
}
