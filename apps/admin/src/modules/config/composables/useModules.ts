import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import { type IModule, type IModuleElement, injectModulesManager } from '../../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_MODULE_TYPE } from '../config.constants';
import type { IModulesComponents, IModulesSchemas } from '../config.types';

import type { IUseModules } from './types';

export const useModules = (): IUseModules => {
	const modulesManager = injectModulesManager();

	const modules = computed<IModule<IModulesComponents, IModulesSchemas>[]>((): IModule<IModulesComponents, IModulesSchemas>[] => {
		const modules = modulesManager.getModules();

		return modules.filter((module) => module.modules?.includes(CONFIG_MODULE_NAME));
	});

	const options = computed<{ value: IModule['type']; label: IModule['name'] }[]>((): { value: IModule['type']; label: IModule['name'] }[] => {
		return orderBy<IModule>(modules.value, [(module) => module.name], ['asc']).map((module) => ({
			value: module.type,
			label: module.name,
		}));
	});

	const getByName = (type: IModule['type']): IModule<IModulesComponents, IModulesSchemas> | undefined => {
		return modules.value.find((module) => module.type === type);
	};

	const getElement = (type: IModule['type']): IModuleElement<IModulesComponents, IModulesSchemas> | undefined => {
		return modules.value.find((module) => module.type === type)?.elements?.find((element) => element.type === CONFIG_MODULE_MODULE_TYPE);
	};

	return {
		modules,
		options,
		getByName,
		getElement,
	};
};

