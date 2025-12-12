import { computed, type MaybeRef, unref } from 'vue';

import { type IModule, type IModuleElement } from '../../../common';
import { CONFIG_MODULE_MODULE_TYPE } from '../config.constants';
import type { IModulesComponents, IModulesSchemas } from '../config.types';

import type { IUseModule } from './types';
import { useModules } from './useModules';

interface IUseModuleProps {
	name: MaybeRef<IModule['type']>;
}

export const useModule = ({ name }: IUseModuleProps): IUseModule => {
	const { getByName } = useModules();

	// Create a computed ref that reactively accesses the name value
	const nameRef = computed(() => unref(name));

	const module = computed<IModule<IModulesComponents, IModulesSchemas> | undefined>((): IModule<IModulesComponents, IModulesSchemas> | undefined => {
		return getByName(nameRef.value);
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

