import { RuleTester } from 'eslint';
import pluginVue from 'eslint-plugin-vue';
import { describe, it } from 'vitest';

import { designSystemRules } from './design-system';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const vueParser = pluginVue.configs['flat/base'].find((config) => config.languageOptions?.parser)?.languageOptions?.parser;

const tester = new RuleTester({
	languageOptions: { parser: vueParser, ecmaVersion: 2022, sourceType: 'module' },
});

// Vitest runs the UnoCSS variant-group transformer over this file, so the fixtures avoid `md:(a b)` groups.
const sfc = (template: string, rest = ''): { code: string; filename: string } => ({
	code: `<template>${template}</template>${rest}`,
	filename: 'component.vue',
});

describe('design system lint rules', () => {
	tester.run('no-gray-utilities', designSystemRules['no-gray-utilities'], {
		valid: [sfc('<div class="text-default bg-fill"></div>'), sfc('<div class="text-gray-500"></div>')],
		invalid: [
			{ ...sfc('<div class="p-2 text-gray-600"></div>'), errors: [{ messageId: 'gray' }] },
			{ ...sfc("<div :class=\"active ? 'bg-gray-200' : ''\"></div>"), errors: [{ messageId: 'gray' }] },
			{ ...sfc('<el-card body-class="dark:hover:bg-gray-800"></el-card>'), errors: [{ messageId: 'gray' }] },
			{ ...sfc('<div class="border-t-gray-600 border-x-gray-600"></div>'), errors: [{ messageId: 'gray' }, { messageId: 'gray' }] },
		],
	});

	tester.run('no-theme-opacity', designSystemRules['no-theme-opacity'], {
		valid: [sfc('<div class="bg-primary-soft bg-black/50"></div>')],
		invalid: [
			{ ...sfc('<div class="bg-danger/10"></div>'), errors: [{ messageId: 'opacity' }] },
			{ ...sfc('<div :class="[`border-primary/20 ${extra}`]"></div>'), errors: [{ messageId: 'opacity' }] },
		],
	});

	tester.run('no-deprecated-classes', designSystemRules['no-deprecated-classes'], {
		valid: [sfc('<div class="bg-brand text-secondary"></div>')],
		invalid: [
			{
				...sfc('<div class="bg-brand-primary"></div>'),
				errors: [{ messageId: 'deprecated', data: { token: 'bg-brand-primary', replacement: 'bg-brand' } }],
			},
			{ ...sfc('<div :class="{ \'text-gray-500\': muted }"></div>'), errors: [{ messageId: 'deprecated' }] },
			{ ...sfc('<div class="dark:fill-brand-primary"></div>'), errors: [{ messageId: 'deprecated' }] },
		],
	});

	tester.run('no-legacy-breakpoints', designSystemRules['no-legacy-breakpoints'], {
		valid: [sfc('<div class="tp:px-4 dt:px-6 sm:hidden !tp:flex"></div>'), sfc('<el-col :md="12"></el-col>')],
		invalid: [
			{ ...sfc('<div class="md:flex"></div>'), errors: [{ messageId: 'breakpoint' }] },
			{ ...sfc('<div class="dark:lg:hidden xl:px-4"></div>'), errors: [{ messageId: 'breakpoint' }, { messageId: 'breakpoint' }] },
			{ ...sfc('<div class="!md:flex dark:!lg:hidden"></div>'), errors: [{ messageId: 'breakpoint' }, { messageId: 'breakpoint' }] },
		],
	});

	tester.run('no-primary-body-text', designSystemRules['no-primary-body-text'], {
		valid: [
			sfc('<span class="text-primary"></span>'),
			sfc('<p class="text-default"></p>'),
			// Strings in conditions and object values are not classes Vue can emit
			sfc('<p :class="{ active: status === \'text-primary\' }"></p>'),
			sfc("<p :class=\"status === 'text-primary' ? 'text-default' : 'text-regular'\"></p>"),
			sfc("<p :class=\"[tone === 'text-primary' && 'font-600', name]\"></p>"),
			// Concatenation: the joined class is checked, fragments that touch a dynamic part are not
			sfc("<p :class=\"'text-primary' + '-soft'\"></p>"),
			sfc('<p :class="\'text-\' + tone"></p>'),
			sfc('<p :class="`text-${tone}`"></p>'),
		],
		invalid: [
			{ ...sfc('<p class="text-sm text-primary"></p>'), errors: [{ messageId: 'body' }] },
			{ ...sfc("<p :class=\"highlighted ? 'text-primary' : 'text-default'\"></p>"), errors: [{ messageId: 'body' }] },
			{ ...sfc('<p :class="{ \'text-primary\': highlighted }"></p>'), errors: [{ messageId: 'body' }] },
			{ ...sfc('<p :class="[highlighted && \'text-primary\']"></p>'), errors: [{ messageId: 'body' }] },
			{ ...sfc("<p :class=\"'text-' + 'primary'\"></p>"), errors: [{ messageId: 'body' }] },
			{ ...sfc("<p :class=\"'text-sm ' + (on ? 'text-primary' : '') + ' ' + extra\"></p>"), errors: [{ messageId: 'body' }] },
			{ ...sfc('<p :class="`${size} text-primary`"></p>'), errors: [{ messageId: 'body' }] },
		],
	});

	tester.run('no-card-shadow', designSystemRules['no-card-shadow'], {
		valid: [sfc('<el-card shadow="never"></el-card>'), sfc('<div shadow="hover"></div>')],
		invalid: [
			{ ...sfc('<el-card shadow="hover"></el-card>'), errors: [{ messageId: 'shadow' }] },
			{ ...sfc('<ElCard :shadow="\'always\'"></ElCard>'), errors: [{ messageId: 'shadow' }] },
		],
	});

	tester.run('no-hex-colors', designSystemRules['no-hex-colors'], {
		valid: [
			sfc('<a href="#add">Add</a>'),
			sfc('<div></div>', '<script setup lang="ts">\n// Fixes #1234\nconst id = 1;\n</script>'),
			sfc('<div>See issue #123</div>'),
			sfc('<div style="color: var(--el-color-danger)"></div>'),
			sfc('<div><!-- colour was #f56c6c --></div>'),
			sfc('<div></div>', '<style scoped>\n/* was #f56c6c */\n.box {\n\tcolor: var(--el-color-danger);\n}\n</style>'),
		],
		invalid: [
			{ ...sfc('<div style="color: #f56c6c"></div>'), errors: [{ messageId: 'hex', data: { value: '#f56c6c' } }] },
			{ ...sfc('<div></div>', '<script setup lang="ts">\nconst colour = \'#909399\';\n</script>'), errors: [{ messageId: 'hex' }] },
			{ ...sfc('<div></div>', '<style scoped>\n.box {\n\tborder-color: #fff;\n}\n</style>'), errors: [{ messageId: 'hex', line: 3 }] },
			// Digits only, after a word: still a colour in CSS
			{ ...sfc('<div></div>', '<style scoped>\n.box {\n\tborder: 1px solid #123;\n}\n</style>'), errors: [{ messageId: 'hex', line: 3 }] },
			// A universal selector is not a comment
			{ ...sfc('<div></div>', '<style scoped>\n* { color: #fff; }\n</style>'), errors: [{ messageId: 'hex', line: 2 }] },
			{ ...sfc('<div style="border: 1px solid #123"></div>'), errors: [{ messageId: 'hex' }] },
			// Comment markers inside script strings are not comments
			{
				...sfc('<div></div>', "<script setup lang=\"ts\">\nconst start = '<!--';\nconst colour = '#fff';\nconst end = '-->';\n</script>"),
				errors: [{ messageId: 'hex', line: 3 }],
			},
		],
	});
});
