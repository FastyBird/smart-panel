import type { ComputedRef, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { FormResultType, IPage } from '../../../modules/dashboard';
import type { ICard } from '../store/cards.store.types';

export interface ICardsFilter {
	search: string | undefined;
	pages: IPage['id'][];
}

export interface ICardAddForm {
	id: ICard['id'];
	type: string;
	title: string;
	icon: string;
	order: number;
}

export interface ICardEditForm {
	id: ICard['id'];
	type: string;
	title: string;
	icon: string;
	order: number;
}

export interface IUseCard {
	card: ComputedRef<ICard | null>;
	isLoading: ComputedRef<boolean>;
	fetchCard: () => Promise<void>;
}

export interface IUseCards {
	cards: ComputedRef<ICard[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchCards: () => Promise<void>;
}

export interface IUseCardsDataSource {
	cards: ComputedRef<ICard[]>;
	cardsPaginated: ComputedRef<ICard[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchCards: () => Promise<void>;
	filters: Ref<ICardsFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'title' | 'order'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
	resetFilter: () => void;
}

export interface IUseCardsActions {
	remove: (id: ICard['id']) => Promise<void>;
}

export interface IUseCardAddForm {
	model: ICardAddForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseCardEditForm {
	model: ICardEditForm;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}
