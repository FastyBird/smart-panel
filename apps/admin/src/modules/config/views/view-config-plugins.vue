<template>
	<el-card v-if="isMDDevice">
		<el-collapse
			v-model="activeNames"
			:expand-icon-position="'left'"
		>
			<template
				v-for="plugin in plugins"
				:key="plugin.type"
			>
				<el-collapse-item
					:title="plugin.name"
					:name="plugin.type"
				>
					<config-plugin
						v-model:remote-form-submit="remoteFormSubmit[plugin.type]"
						v-model:remote-form-result="remoteFormResult[plugin.type]"
						v-model:remote-form-reset="remoteFormReset"
						:type="plugin.type"
					/>
				</el-collapse-item>
			</template>
		</el-collapse>
	</el-card>

	<template v-else>
		<el-collapse
			v-model="activeNames"
			:expand-icon-position="'left'"
		>
			<template
				v-for="plugin in plugins"
				:key="plugin.type"
			>
				<el-collapse-item
					:title="plugin.name"
					:name="plugin.type"
				>
					<config-plugin
						v-model:remote-form-submit="remoteFormSubmit[plugin.type]"
						v-model:remote-form-result="remoteFormResult[plugin.type]"
						v-model:remote-form-reset="remoteFormReset"
						:type="plugin.type"
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

import { ElCard, ElCollapse, ElCollapseItem } from 'element-plus';

import { type IPlugin, useBreakpoints } from '../../../common';
import { ConfigPlugin } from '../components/components';
import { usePlugins } from '../composables/usePlugins';
import { FormResult, type FormResultType, Layout } from '../config.constants';

import type { ViewConfigPluginsProps } from './view-config-plugins.types';

defineOptions({
	name: 'ViewConfigPlugins',
});

const makeInitialRecord = <T,>(initial: T): Record<IPlugin['type'], T> => {
	return Object.fromEntries(plugins.value.map((p) => [p.type as IPlugin['type'], initial])) as Record<IPlugin['type'], T>;
};

const props = withDefaults(defineProps<ViewConfigPluginsProps>(), {
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

const { plugins } = usePlugins();

const remoteFormSubmit = ref<Record<IPlugin['type'], boolean>>(makeInitialRecord<boolean>(props.remoteFormSubmit));
const remoteFormResult = ref<Record<IPlugin['type'], FormResultType>>(makeInitialRecord<FormResultType>(props.remoteFormResult));
const remoteFormReset = ref<boolean>(props.remoteFormReset);

const activeNames = ref(plugins.value.map((plugin) => plugin.type));

const aggregateSubmit = (rec: Record<IPlugin['type'], boolean>): boolean => {
	return Object.values(rec).some(Boolean);
};

const aggregateResult = (rec: Record<IPlugin['type'], FormResultType>): FormResultType => {
	const vals = Object.values(rec);

	if (vals.some((v) => v === FormResult.ERROR)) {
		return FormResult.ERROR;
	}

	if (vals.some((v) => v === FormResult.WORKING)) {
		return FormResult.WORKING;
	}

	if (vals.length && vals.every((v) => v === FormResult.OK)) {
		return FormResult.OK;
	}

	return FormResult.NONE;
};

const waitForPluginToFinish = (type: IPlugin['type']): Promise<void> => {
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
			for (const { type } of plugins.value) {
				remoteFormSubmit.value[type] = true;

				await waitForPluginToFinish(type);

				if (remoteFormResult.value[type] === FormResult.ERROR) {
					// Stop on first error
					emit('update:remoteFormResult', FormResult.ERROR);
					emit('update:remoteFormSubmit', false);

					return;
				}
			}

			// All done, everything OK
			emit('update:remoteFormResult', FormResult.OK);
			emit('update:remoteFormSubmit', false);
		} else {
			for (const { type } of plugins.value) {
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
	() => remoteFormSubmit.value,
	(rec) => {
		emit('update:remoteFormSubmit', aggregateSubmit(rec));
	},
	{ deep: true }
);

watch(
	() => remoteFormResult.value,
	(rec) => {
		emit('update:remoteFormResult', aggregateResult(rec));
	},
	{ deep: true }
);

watch(
	() => plugins.value.map((p) => p.type),
	(types) => {
		const set = new Set(types);

		for (const t of types as IPlugin['type'][]) {
			if (!(t in remoteFormSubmit.value)) {
				remoteFormSubmit.value[t] = false;
			}

			if (!(t in remoteFormResult.value)) {
				remoteFormResult.value[t] = FormResult.NONE;
			}
		}

		for (const key of Object.keys(remoteFormSubmit.value) as IPlugin['type'][]) {
			if (!set.has(key)) {
				delete remoteFormSubmit.value[key];
				delete remoteFormResult.value[key];
			}
		}
	},
	{ immediate: true }
);

useMeta({
	title: t('configModule.meta.configPlugins.title'),
});
</script>
