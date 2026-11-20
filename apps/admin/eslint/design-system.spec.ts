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

// Vitest runs the UnoCSS variant-group transformer over this file, so fixtures with `prefix-(a b)` groups are
// built from pieces the transformer does not recognise.
const group = (prefix: string, items: string): string => [prefix, '(', items, ')'].join('');
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
			{ ...sfc('<div class="shadow-md shadow-gray-500"></div>'), errors: [{ messageId: 'gray', data: { token: 'shadow-gray-500' } }] },
			{
				...sfc('<div class="ring-2 ring-offset-2 ring-offset-gray-500"></div>'),
				errors: [{ messageId: 'gray', data: { token: 'ring-offset-gray-500' } }],
			},
			// Utility groups are expanded first: the second item is checked
			{ ...sfc(`<div class="${group('text-', 'sm gray-600')}"></div>`), errors: [{ messageId: 'gray', data: { token: 'text-gray-600' } }] },
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
		valid: [
			sfc('<div class="bg-brand text-secondary"></div>'),
			// Inherited object members are not map entries
			sfc('<div class="constructor toString __proto__ hasOwnProperty"></div>'),
		],
		invalid: [
			{
				...sfc('<div class="bg-brand-primary"></div>'),
				errors: [{ messageId: 'deprecated', data: { token: 'bg-brand-primary', replacement: 'bg-brand' } }],
			},
			{ ...sfc('<div :class="{ \'text-gray-500\': muted }"></div>'), errors: [{ messageId: 'deprecated' }] },
			{ ...sfc('<div class="dark:fill-brand-primary"></div>'), errors: [{ messageId: 'deprecated' }] },
			{
				...sfc(`<div class="${group('bg-', 'fill gray-100')}"></div>`),
				errors: [{ messageId: 'deprecated', data: { token: 'bg-gray-100', replacement: 'bg-fill' } }],
			},
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
			sfc("<p :class=\"`${active ? 'text-default' : 'text-regular'}`\"></p>"),
			// Objects and arrays in a template string become text, not Vue classes
			sfc('<p :class="`${{ \'text-primary\': true }}`"></p>'),
			sfc("<p :class=\"`${['text-primary', 'font-600']} x`\"></p>"),
			sfc("<p :class=\"'a ' + { 'text-primary': on }\"></p>"),
			// Spreading an array or a string into an object gives index keys, not these classes
			sfc('<p :class="{ ...[\'text-primary\'] }"></p>'),
			sfc('<p :class="{ ...\'text-primary\' }"></p>'),
			// Array spread iterates: a string spreads its characters
			sfc('<p :class="[...\'text-primary\']"></p>'),
			// A computed key is a property name: the array becomes `text-primary,font-600`
			sfc("<p :class=\"{ [['text-primary', 'font-600']]: active }\"></p>"),
			// Statically falsy values leave the key out
			sfc("<p :class=\"{ ...{ 'text-primary': false }, 'text-primary': null }\"></p>"),
			// A later property overrides an earlier one
			sfc("<p :class=\"{ ...{ 'text-primary': true }, 'text-primary': false }\"></p>"),
			// Computed keys known at lint time take part in the same overrides
			sfc('<p :class="{ [\'text-primary\']: false }"></p>'),
			sfc("<p :class=\"{ 'text-primary': true, ['text-primary']: false }\"></p>"),
			sfc("<p :class=\"{ 'text-primary': true, ['text-' + 'primary']: false }\"></p>"),
			// A runtime computed key with a statically falsy value is never emitted
			sfc('<p :class="{ [tone]: false, [`${tone}`]: null }"></p>'),
		],
		invalid: [
			{ ...sfc('<p class="text-sm text-primary"></p>'), errors: [{ messageId: 'body' }] },
			{ ...sfc("<p :class=\"highlighted ? 'text-primary' : 'text-default'\"></p>"), errors: [{ messageId: 'body' }] },
			{ ...sfc('<p :class="{ \'text-primary\': highlighted }"></p>'), errors: [{ messageId: 'body' }] },
			{ ...sfc('<p :class="[highlighted && \'text-primary\']"></p>'), errors: [{ messageId: 'body' }] },
			{ ...sfc('<p :class="{ ...{ \'text-primary\': on } }"></p>'), errors: [{ messageId: 'body' }] },
			{ ...sfc('<p :class="[...[\'text-primary\']]"></p>'), errors: [{ messageId: 'body' }] },
			{ ...sfc("<p :class=\"'text-' + 'primary'\"></p>"), errors: [{ messageId: 'body' }] },
			{ ...sfc("<p :class=\"'text-sm ' + (on ? 'text-primary' : '') + ' ' + extra\"></p>"), errors: [{ messageId: 'body' }] },
			{ ...sfc('<p :class="`${size} text-primary`"></p>'), errors: [{ messageId: 'body' }] },
			// An interpolated array of strings becomes its items joined with commas
			{ ...sfc('<p :class="`${[\'text-primary font-600\']}`"></p>'), errors: [{ messageId: 'body' }] },
			{ ...sfc('<p :class="{ \'text-primary\': true }"></p>'), errors: [{ messageId: 'body' }] },
			{ ...sfc("<p :class=\"{ 'text-primary': false, ...{ 'text-primary': on } }\"></p>"), errors: [{ messageId: 'body' }] },
			{ ...sfc('<p :class="{ [[\'text-primary font-600\']]: true }"></p>'), errors: [{ messageId: 'body' }] },
			{ ...sfc('<p :class="{ [\'text-primary\']: false, [`text-primary`]: on }"></p>'), errors: [{ messageId: 'body' }] },
			{ ...sfc("<p :class=\"`${on ? ['text-primary font-600'] : ''}`\"></p>"), errors: [{ messageId: 'body' }] },
			// A sole interpolation: the empty quasis around it do not touch its classes
			{ ...sfc("<p :class=\"`${active ? 'text-primary' : 'text-default'}`\"></p>"), errors: [{ messageId: 'body' }] },
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
			sfc('<a href = "#abc">Up</a>'),
			sfc('<a :href="\'#abc\'">Up</a>'),
			sfc('<router-link :to="`#fade`">Up</router-link>'),
			sfc('<div></div>', '<script setup lang="ts">\n// Fixes #1234\nconst id = 1;\n</script>'),
			// Selector arguments of DOM queries are IDs, not colours
			sfc(
				'<div @click="$el.closest(\'#abc\')"></div>',
				'<script setup lang="ts">\ndocument.querySelector(\'#abc\');\ndocument.querySelectorAll(`#fade`);\n</script>'
			),
			// Router location hashes are fragments
			sfc(
				"<router-link :to=\"{ name: 'docs', hash: '#abc' }\"></router-link>",
				'<script setup lang="ts">\nrouter.push({ hash: \'#fade\' });\n</script>'
			),
			// Sass: a line that opens a rule is a selector, even with a pseudo-class
			sfc('<div></div>', '<style lang="sass">\na:hover #abc\n  display: block\n</style>'),
			// Sass: a block comment may end where its indentation does
			sfc('<div></div>', '<style lang="sass">\n/* Old palette\n  #abc\n.x\n  display: block\n</style>'),
			sfc('<div>See issue #123</div>'),
			sfc('<div style="color: var(--el-color-danger)"></div>'),
			// Fragment references are not colours
			sfc('<svg><rect filter="url(#fade)" fill="url(\'#abc\')" /></svg>'),
			sfc('<div></div>', '<style>\n.x {\n\tfilter: url(#fade);\n\tmask: url("#bad");\n}\n</style>'),
			// Sass: a comment covers the more deeply indented lines below it
			sfc('<div></div>', '<style lang="sass">\n.x\n  // Old palette\n    color: #abc\n  display: block\n</style>'),
			// SCSS line comments, and colours inside strings, are not declarations
			sfc('<div></div>', '<style lang="scss">\n// previous colour #fff\n.x { color: var(--el-color-primary); content: "#fff"; }\n</style>'),
			// A semicolon in a selector's attribute string does not end it
			sfc('<div></div>', '<style>\n#abc[data-x="a;b"] { display: block; }\n</style>'),
			// Indented syntax: a line without `property:` is a selector
			sfc('<div></div>', '<style lang="sass">\n#abc\n  display: block\na, #fade:hover\n  color: var(--el-color-danger)\n</style>'),
			sfc('<div></div>', '<style lang="stylus">\n#abc\n  display: block\n</style>'),
			// Slot shorthands are directive names
			sfc('<el-table><template #add>x</template><template #fade="{ row }">{{ row }}</template></el-table>'),
			// Selectors inside at-rules
			sfc(
				'<div></div>',
				'<style>\n@scope (#abc) {\n\t.x { display: block; }\n}\n@supports selector(#fade > a) {\n\t.x { display: block; }\n}\n@supports selector(:is(.item) > #abc) {\n\t.x { display: block; }\n}\n</style>'
			),
			// Selector at-rules
			sfc('<div></div>', '<style lang="scss">\n.x {\n\t@extend #abc;\n}\n@at-root #fade {\n\tdisplay: none;\n}\n</style>'),
			// ID selectors are not colours
			sfc('<div></div>', '<style>\n#abc { display: block; }\na:hover, #fade > span {\n\tcolor: var(--el-color-danger);\n}\n</style>'),
			sfc('<div></div>', '<style lang="scss">\n.box {\n\t#bad {\n\t\tdisplay: none;\n\t}\n}\n</style>'),
			sfc('<div><!-- colour was #f56c6c --></div>'),
			sfc('<div></div>', '<style scoped>\n/* was #f56c6c */\n.box {\n\tcolor: var(--el-color-danger);\n}\n</style>'),
		],
		invalid: [
			{ ...sfc('<div style="color: #f56c6c"></div>'), errors: [{ messageId: 'hex', data: { value: '#f56c6c' } }] },
			{ ...sfc('<div></div>', '<script setup lang="ts">\nconst colour = \'#909399\';\n</script>'), errors: [{ messageId: 'hex' }] },
			{ ...sfc('<div></div>', '<style scoped>\n.box {\n\tborder-color: #fff;\n}\n</style>'), errors: [{ messageId: 'hex', line: 3 }] },
			// Indented syntax: declarations are still checked
			{ ...sfc('<div></div>', '<style lang="sass">\n#abc\n  color: #fff\n</style>'), errors: [{ messageId: 'hex', line: 3 }] },
			{
				...sfc('<div></div>', '<style lang="sass">\n/* Old palette\n  old values\n.x\n  color: #fff\n</style>'),
				errors: [{ messageId: 'hex', line: 5 }],
			},
			// Interpolations inside an exempt literal are still checked
			{
				...sfc(
					'<div></div>',
					"<script setup lang=\"ts\">\nrouter.push({ hash: `#${(el.style.color = '#fff')}` });\ndocument.querySelector(`#a ${'#abc'}`);\n</script>"
				),
				errors: [
					{ messageId: 'hex', data: { value: '#fff' } },
					{ messageId: 'hex', data: { value: '#abc' } },
				],
			},
			// Only the selector argument is exempt
			{
				...sfc('<div></div>', "<script setup lang=\"ts\">\ndocument.querySelector('#abc', '#fff');\n</script>"),
				errors: [{ messageId: 'hex', data: { value: '#fff' } }],
			},
			// …and the comment ends at the next line that is not indented deeper
			{ ...sfc('<div></div>', '<style lang="sass">\n.x\n  // Old palette\n  color: #abc\n</style>'), errors: [{ messageId: 'hex', line: 4 }] },
			// A declaration continues across lines while a parenthesis is open
			{
				...sfc('<div></div>', '<style lang="sass">\n.x\n  color: mix(\n    #fff, #000)\n</style>'),
				errors: [
					{ messageId: 'hex', line: 4 },
					{ messageId: 'hex', line: 4 },
				],
			},
			// A line with open parentheses continues, so it does not open a rule
			{
				...sfc('<div></div>', '<style lang="sass">\n.x\n  color: mix(#fff,\n    #000)\n</style>'),
				errors: [
					{ messageId: 'hex', line: 3 },
					{ messageId: 'hex', line: 4 },
				],
			},
			// An escaped `)` does not end an unquoted url()
			{
				...sfc('<div></div>', '<style>\n.x {\n\tmask: url(sprite\\)#abc);\n\tcolor: #fff;\n}\n</style>'),
				errors: [{ messageId: 'hex', data: { value: '#fff' } }],
			},
			// Sass variables are values
			{ ...sfc('<div></div>', '<style lang="sass">\n$tone: #fff\n.x\n  color: $tone\n</style>'), errors: [{ messageId: 'hex', line: 2 }] },
			// A colour condition next to selector() is still a value
			{
				...sfc('<div></div>', '<style>\n@supports selector(#abc) and (color: #fff) {\n\t.x { display: block; }\n}\n</style>'),
				errors: [{ messageId: 'hex', data: { value: '#fff' } }],
			},
			{
				...sfc('<div></div>', '<style>\n@supports selector(:is(.a) > #abc) and (color: #fff) {\n\t.x { display: block; }\n}\n</style>'),
				errors: [{ messageId: 'hex', data: { value: '#fff' } }],
			},
			// At-rule conditions are values, not selectors
			{
				...sfc('<div></div>', '<style>\n@supports (color: #fff) {\n\t.x { display: block; }\n}\n</style>'),
				errors: [{ messageId: 'hex', line: 2 }],
			},
			{ ...sfc('<div></div>', '<style>\n@container style(--tone: #abc) {\n\t.x { display: block; }\n}\n</style>'), errors: [{ messageId: 'hex' }] },
			// A brace inside a comment does not turn a declaration into a selector
			{ ...sfc('<div></div>', '<style>\n.x { color: #fff /* { */; }\n</style>'), errors: [{ messageId: 'hex', line: 2 }] },
			// `//` is not a comment in plain CSS
			{ ...sfc('<div></div>', '<style>\n.x { color: #fff; } // not a comment #000\n</style>'), errors: [{ messageId: 'hex' }, { messageId: 'hex' }] },
			// A selector ID and a declaration colour in the same block: only the colour is reported
			{ ...sfc('<div></div>', '<style>\n#abc { color: #abc; }\n</style>'), errors: [{ messageId: 'hex', line: 2, column: 15 }] },
			// Digits only, after a word: still a colour in CSS
			{ ...sfc('<div></div>', '<style scoped>\n.box {\n\tborder: 1px solid #123;\n}\n</style>'), errors: [{ messageId: 'hex', line: 3 }] },
			// A universal selector is not a comment
			{ ...sfc('<div></div>', '<style scoped>\n* { color: #fff; }\n</style>'), errors: [{ messageId: 'hex', line: 2 }] },
			{ ...sfc('<div style="border: 1px solid #123"></div>'), errors: [{ messageId: 'hex' }] },
			// Comment delimiters inside CSS strings are not comments
			{
				...sfc('<div></div>', '<style scoped>\n.x {\n\tcontent: "/*";\n\tcolor: #fff;\n\t--marker: "*/";\n}\n</style>'),
				errors: [{ messageId: 'hex', line: 4 }],
			},
			// Comment markers inside script strings are not comments
			{
				...sfc('<div></div>', "<script setup lang=\"ts\">\nconst start = '<!--';\nconst colour = '#fff';\nconst end = '-->';\n</script>"),
				errors: [{ messageId: 'hex', line: 3 }],
			},
		],
	});
});
