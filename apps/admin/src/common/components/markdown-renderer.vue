<template>
	<div
		class="markdown-renderer"
		:class="props.class"
		v-html="sanitizedHtml"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import DOMPurify from 'dompurify';
import { marked } from 'marked';

import type { IMarkdownRendererProps } from './markdown-renderer.types';

defineOptions({
	name: 'MarkdownRenderer',
});

const props = defineProps<IMarkdownRendererProps>();

// Configure DOMPurify to allow safe tags only
const purifyConfig: DOMPurify.Config = {
	ALLOWED_TAGS: [
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'p',
		'br',
		'hr',
		'ul',
		'ol',
		'li',
		'blockquote',
		'pre',
		'code',
		'em',
		'strong',
		'del',
		'a',
		'img',
		'table',
		'thead',
		'tbody',
		'tr',
		'th',
		'td',
	],
	ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
	ALLOW_DATA_ATTR: false,
	ADD_ATTR: ['target', 'rel'],
};

// Configure marked options
marked.setOptions({
	gfm: true,
	breaks: true,
});

const sanitizedHtml = computed<string>(() => {
	if (!props.content) {
		return '';
	}

	// Parse markdown to HTML
	const rawHtml = marked.parse(props.content) as string;

	// Sanitize HTML to prevent XSS
	const cleanHtml = DOMPurify.sanitize(rawHtml, purifyConfig);

	// Add target="_blank" and rel="noopener noreferrer" to all links
	return cleanHtml.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
});
</script>

<style lang="scss" scoped>
.markdown-renderer {
	line-height: 1.6;

	:deep(h1),
	:deep(h2),
	:deep(h3),
	:deep(h4),
	:deep(h5),
	:deep(h6) {
		margin-top: 1em;
		margin-bottom: 0.5em;
		font-weight: 600;
	}

	:deep(h1) {
		font-size: 1.5em;
	}

	:deep(h2) {
		font-size: 1.3em;
	}

	:deep(h3) {
		font-size: 1.1em;
	}

	:deep(p) {
		margin: 0.5em 0;
	}

	:deep(ul),
	:deep(ol) {
		margin: 0.5em 0;
		padding-left: 1.5em;
	}

	:deep(li) {
		margin: 0.25em 0;
	}

	:deep(pre) {
		background: var(--el-fill-color-light);
		padding: 1em;
		border-radius: 4px;
		overflow-x: auto;
	}

	:deep(code) {
		background: var(--el-fill-color-light);
		padding: 0.2em 0.4em;
		border-radius: 3px;
		font-family: monospace;
		font-size: 0.9em;
	}

	:deep(pre code) {
		background: none;
		padding: 0;
	}

	:deep(blockquote) {
		border-left: 3px solid var(--el-border-color);
		margin: 0.5em 0;
		padding-left: 1em;
		color: var(--el-text-color-secondary);
	}

	:deep(a) {
		color: var(--el-color-primary);
		text-decoration: none;

		&:hover {
			text-decoration: underline;
		}
	}

	:deep(img) {
		max-width: 100%;
		height: auto;
	}

	:deep(table) {
		border-collapse: collapse;
		width: 100%;
		margin: 0.5em 0;
	}

	:deep(th),
	:deep(td) {
		border: 1px solid var(--el-border-color);
		padding: 0.5em;
		text-align: left;
	}

	:deep(th) {
		background: var(--el-fill-color-light);
		font-weight: 600;
	}

	:deep(hr) {
		border: none;
		border-top: 1px solid var(--el-border-color);
		margin: 1em 0;
	}
}
</style>
