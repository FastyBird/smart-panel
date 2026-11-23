<template>
	<div
		ref="scroller"
		class="flex-1 min-h-0 overflow-y-auto"
		data-test-id="settings-layout"
		@scroll.passive="onScroll"
	>
		<!-- Template 5, settings and status: one health banner, a 168 px anchor nav from desktop and the section cards -->
		<div class="page-pad box-border flex flex-col gap-4 w-full max-w-[1200px]">
			<slot name="banner" />

			<div class="flex items-start gap-6">
				<nav
					v-if="isDesktop && props.sections.length > 0"
					:aria-label="t('application.settingsLayout.sections')"
					class="sticky top-6 w-[168px] shrink-0"
					data-test-id="settings-layout-nav"
				>
					<ul class="flex flex-col gap-0.5 m-0 p-0 list-none">
						<li
							v-for="section in props.sections"
							:key="section.id"
						>
							<a
								:href="`#${section.id}`"
								:aria-current="active === section.id ? 'location' : undefined"
								:class="[
									'flex items-center gap-2 px-3 py-1.5 rounded-[var(--el-border-radius-base)] text-[14px] leading-[22px] no-underline',
									active === section.id ? 'bg-primary-soft text-primary font-500' : 'text-regular hover:bg-fill-light',
								]"
								:data-section-id="section.id"
								data-test-id="settings-layout-link"
								@click.prevent="goTo(section.id)"
							>
								<icon
									v-if="section.icon"
									:icon="section.icon"
									width="18"
									height="18"
									class="shrink-0"
								/>
								<span class="flex-1 min-w-0 truncate">{{ section.label }}</span>
								<span
									v-if="section.count"
									class="text-caption tabular-nums"
								>
									{{ section.count }}
								</span>
							</a>
						</li>
					</ul>
				</nav>

				<div class="flex flex-col gap-4 flex-1 min-w-0">
					<slot />
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

import { useSizeClass } from '../composables/useSizeClass';

import type { SettingsLayoutProps } from './settings-layout.types';

defineOptions({
	name: 'SettingsLayout',
});

const props = defineProps<SettingsLayoutProps>();

const { t } = useI18n();

const { isDesktop } = useSizeClass();

const scroller = ref<HTMLElement | null>(null);

const active = ref<string | null>(props.sections[0]?.id ?? null);

// How far below the top of the scroller a section's heading may be and still count as the one being read
const READING_LINE = 96;

const sectionElement = (id: string): HTMLElement | null => {
	const element = scroller.value?.ownerDocument.getElementById(id) ?? null;

	return element && scroller.value?.contains(element) ? element : null;
};

// The section being read is the last one whose top has passed the reading line; at the bottom of a page that scrolls it
// is the last section, which may be too short ever to reach that line
const onScroll = (): void => {
	const container = scroller.value;

	if (!container || props.sections.length === 0) {
		return;
	}

	const scrolls = container.scrollHeight > container.clientHeight;

	if (scrolls && container.scrollTop + container.clientHeight >= container.scrollHeight - 2) {
		active.value = props.sections[props.sections.length - 1].id;

		return;
	}

	const top = container.getBoundingClientRect().top;

	let current = props.sections[0].id;

	for (const section of props.sections) {
		const element = sectionElement(section.id);

		if (element && element.getBoundingClientRect().top - top <= READING_LINE) {
			current = section.id;
		}
	}

	active.value = current;
};

const goTo = (id: string): void => {
	active.value = id;

	sectionElement(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

watch(
	(): string[] => props.sections.map((section) => section.id),
	(ids): void => {
		if (active.value === null || !ids.includes(active.value)) {
			active.value = ids[0] ?? null;
		}
	}
);

onMounted((): void => {
	void nextTick(onScroll);
});

defineExpose({ goTo });
</script>
