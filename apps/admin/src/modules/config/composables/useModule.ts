import { computed } from 'vue';

import { type IModule, type IModuleElement } from '../../../common';
import { CONFIG_MODULE_MODULE_TYPE } from '../config.constants';
import type { IModulesComponents, IModulesSchemas } from '../config.types';

import type { IUseModule } from './types';
import { useModules } from './useModules';

interface IUseModuleProps {
	name: IModule['type'];
}

export const useModule = ({ name }: IUseModuleProps): IUseModule => {
	const { getByName } = useModules();

	const module = computed<IModule<IModulesComponents, IModulesSchemas> | undefined>((): IModule<IModulesComponents, IModulesSchemas> | undefined => {
		return getByName(name);
	});

	const element = computed<IModuleElement<IModulesComponents, IModulesSchemas> | undefined>(
		(): IModuleElement<IModulesComponents, IModulesSchemas> | undefined => {
			return module.value?.elements?.find((element) => element.type === CONFIG_MODULE_MODULE_TYPE);
		}
	);

	return {
		module,
		element,
	};
};

