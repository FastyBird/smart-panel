/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { ComponentOptionsMixin, DefineComponent } from 'vue';

import type { ZodTypeAny } from 'zod';

import type { ILocationAddFormProps } from './components/location-add-form.types';
import { locationAddFormEmits } from './components/location-add-form.types';
import type { ILocationEditFormProps } from './components/location-edit-form.types';
import { locationEditFormEmits } from './components/location-edit-form.types';

export type ILocationPluginsComponents = {
	locationAddForm?: DefineComponent<
		ILocationAddFormProps,
		{},
		{},
		{},
		{},
		ComponentOptionsMixin,
		ComponentOptionsMixin,
		typeof locationAddFormEmits
	>;
	locationEditForm?: DefineComponent<
		ILocationEditFormProps,
		{},
		{},
		{},
		{},
		ComponentOptionsMixin,
		ComponentOptionsMixin,
		typeof locationEditFormEmits
	>;
};

export type ILocationPluginsSchemas = {
	locationSchema?: ZodTypeAny;
	locationAddFormSchema?: ZodTypeAny;
	locationEditFormSchema?: ZodTypeAny;
	locationCreateReqSchema?: ZodTypeAny;
	locationUpdateReqSchema?: ZodTypeAny;
};
