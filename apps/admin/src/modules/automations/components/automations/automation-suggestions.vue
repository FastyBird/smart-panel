<template>
	<div
		v-if="props.suggestions.length > 0"
		class="flex flex-col gap-2 p-3 rounded-md b-1 b-solid automation-suggestions"
		data-test-id="automation-suggestions"
	>
		<div class="flex flex-row items-center gap-2">
			<icon
				icon="mdi:robot-happy-outline"
				class="text-lg"
			/>
			<el-text tag="b">
				{{ t('automations.suggestions.headings.list') }}
			</el-text>
		</div>

		<el-text
			size="small"
			type="info"
		>
			{{ t('automations.suggestions.texts.list') }}
		</el-text>

		<div
			v-for="suggestion in props.suggestions"
			:key="suggestion.id"
			class="flex flex-row flex-wrap items-center gap-3 pt-2 b-t-1 b-t-solid automation-suggestions__item"
			:data-test-suggestion="suggestion.id"
		>
			<div class="flex flex-col grow-1 min-w-0">
				<el-text
					tag="b"
					truncated
				>
					{{ suggestion.draft.name }}
				</el-text>
				<el-text size="small">
					{{ suggestion.reason }}
				</el-text>
			</div>

			<div class="flex flex-row items-center gap-2">
				<el-button
					size="small"
					:disabled="answering(suggestion.id)"
					data-test-id="automation-suggestion-dismiss"
					@click="emit('dismiss', suggestion)"
				>
					{{ t('automations.suggestions.buttons.dismiss.title') }}
				</el-button>

				<el-button
					type="primary"
					size="small"
					plain
					:disabled="answering(suggestion.id)"
					data-test-id="automation-suggestion-open"
					@click="emit('open', suggestion)"
				>
					<template #icon>
						<icon icon="mdi:sitemap-outline" />
					</template>

					{{ t('automations.suggestions.buttons.open.title') }}
				</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * The automations Buddy suggests for routines it noticed. Opening one hands its draft to the add form and the
 * editor, as a template draft is; nothing is created until the automation is saved there.
 */
import { useI18n } from 'vue-i18n';

import { ElButton, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IAutomationSuggestion } from '../../composables/types';

import type { IAutomationSuggestionsProps } from './automation-suggestions.types';

defineOptions({
	name: 'AutomationSuggestions',
});

const props = withDefaults(defineProps<IAutomationSuggestionsProps>(), {
	answering: () => [],
});

const emit = defineEmits<{
	(e: 'open', suggestion: IAutomationSuggestion): void;
	(e: 'dismiss', suggestion: IAutomationSuggestion): void;
}>();

const { t } = useI18n();

const answering = (id: IAutomationSuggestion['id']): boolean => props.answering.includes(id);
</script>

<style scoped>
.automation-suggestions,
.automation-suggestions__item {
	border-color: var(--el-border-color);
}
</style>
