import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';
import { z } from 'zod';

import type { ISpace } from '../../spaces/store/spaces.store.types';
import type { AutomationMode, FormResultType } from '../automations.constants';
import type { IAutomationAddForm, IAutomationEditForm } from '../schemas/automations.types';
import type { IAutomation } from '../store/automations.store.types';

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
