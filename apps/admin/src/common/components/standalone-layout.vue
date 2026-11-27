<template>
	<!-- Template 10, standalone: a screen outside the shell is one centred card with the brand mark, its title and large
	     buttons. The same on every size: the card fills the width on a phone and stops at 480 px above it -->
	<div
		class="flex flex-col items-center justify-start tp:justify-center gap-6 w-full min-h-full box-border p-3 tp:p-6 overflow-y-auto bg-[var(--el-bg-color-page)]"
		data-test-id="standalone-layout"
	>
		<section
			:aria-labelledby="titleId"
			class="flex flex-col gap-5 w-full max-w-[480px] box-border p-5 tp:p-8 bg-surface border border-solid border-light rounded-lg"
		>
			<div class="flex flex-col items-center gap-3 text-center">
				<router-link
					v-if="props.logoTo && props.logoLabel"
					:to="props.logoTo"
					:aria-label="props.logoLabel"
					class="flex"
					data-test-id="standalone-layout-logo"
				>
					<logo
						class="w-16 fill-brand"
						aria-hidden="true"
					/>
				</router-link>
				<logo
					v-else
					class="w-16 fill-brand"
					aria-hidden="true"
					data-test-id="standalone-layout-logo"
				/>

				<h1
					:id="titleId"
					class="m-0 text-[22px] leading-[30px] font-600 text-default"
					data-test-id="standalone-layout-title"
				>
					{{ props.title }}
				</h1>
				<p
					v-if="props.subtitle"
					class="m-0 text-help"
					data-test-id="standalone-layout-subtitle"
				>
					{{ props.subtitle }}
				</p>
			</div>

			<slot />
		</section>

		<footer
			v-if="props.links"
			class="flex flex-col items-center gap-3 text-help"
			data-test-id="standalone-layout-links"
		>
			<nav
				:aria-label="t('application.standalone.links')"
				class="flex items-center gap-1"
			>
				<a
					v-for="link in LINKS"
					:key="link.href"
					:href="link.href"
					:aria-label="link.label"
					:title="link.label"
					target="_blank"
					rel="noopener noreferrer"
					class="flex items-center justify-center w-10 h-10 rounded-full text-secondary hover:text-default hover:bg-fill"
				>
					<icon
						:icon="link.icon"
						width="20"
						height="20"
						aria-hidden="true"
					/>
				</a>
			</nav>

			<span class="flex items-baseline gap-1">
				&copy;
				<a
					href="https://smart-panel.fastybird.com"
					target="_blank"
					rel="noopener noreferrer"
					class="text-primary no-underline hover:underline"
					data-test-id="author-link"
				>
					FastyBird Team
				</a>
				2024
			</span>
		</footer>
	</div>
</template>

<script setup lang="ts">
import { useId } from 'vue';
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

import Logo from '../../assets/images/fb_bird.svg?component';

import type { StandaloneLayoutProps } from './standalone-layout.types';

defineOptions({
	name: 'StandaloneLayout',
});

const props = withDefaults(defineProps<StandaloneLayoutProps>(), {
	subtitle: undefined,
	logoTo: undefined,
	logoLabel: undefined,
	links: true,
});

const { t } = useI18n();

const titleId = `standalone-layout-title-${useId()}`;

// The project's own channels: names of products, so they are not translated
const LINKS: { href: string; icon: string; label: string }[] = [
	{ href: 'https://github.com/fastybird', icon: 'mdi:github', label: 'GitHub' },
	{ href: 'https://x.com/fastybird', icon: 'fa6-brands:x-twitter', label: 'X' },
	{ href: 'https://discord.gg/HPRJ2GzK', icon: 'mdi:discord', label: 'Discord' },
	{ href: 'https://www.facebook.com/fastybird', icon: 'mdi:facebook', label: 'Facebook' },
];
</script>
