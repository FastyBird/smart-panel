<template>
	<el-scrollbar
		v-if="isMDDevice"
		class="grow-1 flex flex-col"
	>
		<el-card class="mb-2">
			<el-collapse
				v-model="activeName"
				:expand-icon-position="'left'"
				accordion
			>
				<template
					v-for="module in modules"
					:key="module.type"
				>
					<el-collapse-item
						:title="module.name"
						:name="module.type"
					>
						<config-module
							v-model:remote-form-submit="remoteFormSubmit[module.type]"
							v-model:remote-form-result="remoteFormResult[module.type]"
							v-model:remote-form-reset="remoteFormReset"
							:type="module.type"
						/>
					</el-collapse-item>
				</template>
			</el-collapse>
		</el-card>
	</el-scrollbar>

	<template v-else>
		<el-collapse
			v-model="activeName"
			:expand-icon-position="'left'"
			accordion
		>
			<template
				v-for="module in modules"
				:key="module.type"
			>
				<el-collapse-item
					:title="module.name"
					:name="module.type"
				>
					<config-module
						v-model:remote-form-submit="remoteFormSubmit[module.type]"
						v-model:remote-form-result="remoteFormResult[module.type]"
						v-model:remote-form-reset="remoteFormReset"
						:type="module.type"
						:layout="Layout.PHONE"
					/>
				</el-collapse-item>
			</template>
		</el-collapse>
	</template>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';

import { ElCard, ElCollapse, ElCollapseItem, ElScrollbar } from 'element-plus';

import { type IModule, useBreakpoints } from '../../../common';
import { ConfigModule } from '../components/components';
import { useModules } from '../composables/useModules';
import { FormResult, type FormResultType, Layout } from '../config.constants';

import type { ViewConfigModulesProps } from './view-config-modules.types';

defineOptions({
	name: 'ViewConfigModules',
});

const makeInitialRecord = <T,>(initial: T): Record<IModule['type'], T> => {
	return Object.fromEntries(modules.value.map((m) => [m.type as IModule['type'], initial])) as Record<IModule['type'], T>;
};

const props = withDefaults(defineProps<ViewConfigModulesProps>(), {
	remoteFormSubmit: false,
	remoteFormResult: FormResult.NONE,
	remoteFormReset: false,
});

const emit = defineEmits<{
	(e: 'update:remoteFormSubmit', remoteFormSubmit: boolean): void;
	(e: 'update:remoteFormResult', remoteFormResult: FormResultType): void;
	(e: 'update:remoteFormReset', remoteFormReset: boolean): void;
}>();

const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const { modules, getElement } = useModules();

const remoteFormSubmit = ref<Record<IModule['type'], boolean>>(makeInitialRecord<boolean>(props.remoteFormSubmit));
const remoteFormResult = ref<Record<IModule['type'], FormResultType>>(makeInitialRecord<FormResultType>(props.remoteFormResult));
const remoteFormReset = ref<boolean>(props.remoteFormReset);

const activeNames = ref(modules.value.map((module) => module.type));
const activeName = ref(activeNames.value ? activeNames.value[0] : undefined);

const waitForModuleToFinish = (type: IModule['type']): Promise<void> => {
	const element = getElement(type);

	// If the module doesn't have a config form component, immediately resolve
	// since there's nothing to save
	if (!element?.components?.moduleConfigEditForm) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		const stop = watch(
			() => remoteFormResult.value[type],
			(res) => {
				if (res === FormResult.OK || res === FormResult.ERROR) {
					remoteFormSubmit.value[type] = false;

					stop();

					resolve();
				}
			}
		);
	});
};

watch(
	(): boolean => props.remoteFormSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			for (const { type } of modules.value) {
				const element = getElement(type);

				// Only trigger form submit for modules that have a config form component
				if (element?.components?.moduleConfigEditForm) {
					setTimeout(() => {
						remoteFormSubmit.value[type] = true;
					}, 500);

					await waitForModuleToFinish(type);

					if (remoteFormResult.value[type] === FormResult.ERROR) {
						// Stop on first error
						emit('update:remoteFormResult', FormResult.ERROR);
						emit('update:remoteFormSubmit', false);

						return;
					}
				}
			}

			// All done, everything OK
			emit('update:remoteFormResult', FormResult.OK);
			emit('update:remoteFormSubmit', false);
		} else {
			for (const { type } of modules.value) {
				remoteFormSubmit.value[type] = val;
			}
		}
	}
);

watch(
	(): boolean => props.remoteFormReset,
	async (val: boolean): Promise<void> => {
		remoteFormReset.value = val;
	}
);

watch(
	(): boolean => remoteFormReset.value,
	async (val: boolean): Promise<void> => {
		emit('update:remoteFormReset', val);
	}
);

watch(
	() => modules.value.map((m) => m.type),
	(types) => {
		const set = new Set(types);

		for (const t of types as IModule['type'][]) {
			if (!(t in remoteFormSubmit.value)) {
				remoteFormSubmit.value[t] = false;
			}

			if (!(t in remoteFormResult.value)) {
				remoteFormResult.value[t] = FormResult.NONE;
			}
		}

		for (const key of Object.keys(remoteFormSubmit.value) as IModule['type'][]) {
			if (!set.has(key)) {
				delete remoteFormSubmit.value[key];
				delete remoteFormResult.value[key];
			}
		}
	},
	{ immediate: true }
);

useMeta({
	title: t('configModule.meta.configModules.title'),
});
</script>

