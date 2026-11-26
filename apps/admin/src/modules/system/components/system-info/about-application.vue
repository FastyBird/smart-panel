<template>
	<!-- The About section: the application, its version, what it is and where to follow it -->
	<div class="flex flex-col gap-4">
		<div class="flex items-center gap-4">
			<div
				class="flex items-center justify-center shrink-0 w-14 h-14 rounded-lg bg-primary-soft"
				aria-hidden="true"
			>
				<icon
					icon="mdi:cog-outline"
					width="32"
					height="32"
					class="text-primary"
				/>
			</div>

			<div class="flex flex-col gap-0.5 min-w-0">
				<span class="text-section">FastyBird! Smart Panel</span>
				<span
					class="text-secondary"
					data-test-id="about-version"
				>
					{{ t('systemModule.texts.system.version', { version: appVersion }) }}
				</span>
			</div>
		</div>

		<p
			class="text-body m-0 max-w-[640px]"
			data-test-id="about-info"
		>
			{{ t('systemModule.texts.system.about') }}
		</p>

		<ul
			:aria-label="t('systemModule.labels.about.links')"
			class="flex flex-wrap gap-2 m-0 p-0 list-none"
		>
			<li
				v-for="link in LINKS"
				:key="link.href"
			>
				<a
					:href="link.href"
					class="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--el-border-radius-base)] border border-solid border-default text-regular no-underline hover:border-primary hover:text-primary"
					target="_blank"
					rel="noopener noreferrer"
				>
					<icon
						:icon="link.icon"
						aria-hidden="true"
					/>
					{{ link.label }}
				</a>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

defineOptions({
	name: 'AboutApplication',
});

const { t } = useI18n();

const appVersion: string = __APP_VERSION__;

// Brand names, the same in every language
const LINKS: { href: string; icon: string; label: string }[] = [
	{ href: 'https://github.com/fastybird', icon: 'mdi:github', label: 'GitHub' },
	{ href: 'https://x.com/fastybird', icon: 'fa6-brands:x-twitter', label: 'X' },
	{ href: 'https://discord.gg/HPRJ2GzK', icon: 'mdi:discord', label: 'Discord' },
	{ href: 'https://www.facebook.com/fastybird', icon: 'mdi:facebook', label: 'Facebook' },
];
</script>
