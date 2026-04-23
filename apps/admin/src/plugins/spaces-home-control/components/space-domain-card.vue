<template>
	<el-card
		shadow="hover"
		class="space-domain-card"
		body-class="p-4!"
		@click="emit('click')"
	>
		<div class="flex items-start gap-3">
			<div
				class="space-domain-card__icon"
				:style="{
					backgroundColor: `var(--el-color-${props.iconColor}-light-9)`,
					color: `var(--el-color-${props.iconColor})`,
				}"
			>
				<icon :icon="props.icon" />
			</div>
			<div class="flex-1 min-w-0 space-domain-card__content">
				<h3 class="space-domain-card__title">
					{{ props.title }}
				</h3>
				<p class="space-domain-card__description">
					{{ props.description }}
				</p>
				<div class="space-domain-card__tags">
					<template v-if="props.loading">
						<el-skeleton
							animated
							:rows="0"
							class="w-20"
						/>
					</template>
					<template v-else-if="props.tags.length > 0">
						<el-tag
							v-for="tag in props.tags"
							:key="tag.label"
							:type="tag.type"
							size="small"
						>
							<div class="flex items-center gap-1">
								<icon :icon="tag.icon" />
								{{ tag.label }}
								<el-badge
									:value="tag.count"
									:type="tag.type"
									class="ml-1"
								/>
							</div>
						</el-tag>
					</template>
					<span
						v-else
						class="space-domain-card__not-configured"
					>
						{{ t('spacesModule.detail.domains.notConfigured') }}
					</span>
				</div>
			</div>
			<div class="space-domain-card__chevron">
				<icon icon="mdi:chevron-right" />
			</div>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElBadge, ElCard, ElSkeleton, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { ISpaceDomainCardProps } from './space-domain-card.types';

defineOptions({
	name: 'SpaceDomainCard',
});

const props = defineProps<ISpaceDomainCardProps>();

const emit = defineEmits<{
	(e: 'click'): void;
}>();

const { t } = useI18n();
</script>

<style scoped lang="scss">
.space-domain-card {
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		.space-domain-card__chevron {
			opacity: 1;
			transform: translateX(2px);
		}
	}
}

.space-domain-card__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 2.5rem;
	height: 2.5rem;
	border-radius: var(--el-border-radius-base);
	font-size: 1.25rem;
	flex-shrink: 0;
}

.space-domain-card__content {
	display: flex;
	flex-direction: column;
	min-height: 6.5rem;
}

.space-domain-card__title {
	margin: 0 0 0.25rem 0;
	font-size: 0.9375rem;
	font-weight: 600;
	line-height: 1.3;
	color: var(--el-text-color-primary);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.space-domain-card__description {
	margin: 0 0 0.5rem 0;
	font-size: 0.8125rem;
	line-height: 1.4;
	color: var(--el-text-color-secondary);
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.space-domain-card__tags {
	display: flex;
	flex-wrap: wrap;
	gap: 0.375rem;
	align-items: center;
	min-height: 1.5rem;
}

.space-domain-card__not-configured {
	font-size: 0.8125rem;
	color: var(--el-text-color-placeholder);
}

.space-domain-card__chevron {
	display: flex;
	align-items: center;
	color: var(--el-text-color-placeholder);
	font-size: 1.25rem;
	opacity: 0.5;
	transition: all 0.2s ease;
	flex-shrink: 0;
	align-self: center;
}
</style>
