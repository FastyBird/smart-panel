/*
 * Design system lint rules for the admin (docs/admin-ui-design-spec.md, section 3).
 *
 * The rules read the classes of Vue templates (static `class` and `*-class` attributes, and the string
 * literals and object keys of their bound `:class` expressions) and, for hex colours, the whole `.vue` file.
 * `eslint.config.ts` decides where they warn and where they are errors.
 */
import type { AST, Rule } from 'eslint';
import { expandVariantGroup } from 'unocss';

import { DEPRECATED_CLASSES } from '../uno.theme';

type TemplateNode = { type: string; range: [number, number]; loc: AST.SourceLocation } & Record<string, unknown>;

interface IClassToken {
	token: string;
	node: TemplateNode;
}

interface IParserServices {
	defineTemplateBodyVisitor?: (templateVisitor: Record<string, (node: TemplateNode) => void>, scriptVisitor?: Rule.RuleListener) => Rule.RuleListener;
	getDocumentFragment?: () => IDocumentFragment | null;
}

interface IStartTag {
	range: [number, number];
	attributes?: { directive?: boolean; key?: { name?: unknown }; value?: { value?: unknown } | null }[];
}

interface IDocumentFragment {
	comments: { type: string; range: [number, number] }[];
	children: { type: string; name?: string; startTag?: IStartTag; endTag?: { range: [number, number] } | null }[];
}

const THEME_COLOURS = '(?:primary|success|warning|danger|info|brand)';

const GRAY_UTILITY =
	/(?:^|[:(!])(?:text|bg|border(?:-[trblxyse])?|fill|stroke|ring|divide|outline|placeholder|from|via|to|decoration|caret|accent)-gray-\d+/;
const THEME_OPACITY = new RegExp(`(?:^|[:(!])(?:bg|text|border|fill)-${THEME_COLOURS}\\/\\d+`);
const LEGACY_BREAKPOINT = /(?:^|[:(!])(?:md|lg|xl):/;
const HEX_COLOUR = /(?<![\w&/#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;

/** `dark:hover:!bg-gray-50!` → `bg-gray-50`; variant groups lose their parentheses */
const bareClass = (token: string): string => {
	const withoutGroup = token.replace(/[()]/g, '');
	const withoutVariants = withoutGroup.slice(withoutGroup.lastIndexOf(':') + 1);

	return withoutVariants.replace(/^!|!$/g, '');
};

/** Class tokens of a string, with variant and utility groups expanded as transformerVariantGroup does (`bg-(fill gray-100)`) */
const splitClasses = (value: string): string[] =>
	expandVariantGroup(value)
		.split(/\s+/)
		.filter((token) => token.length > 0);

/**
 * Every class name a bound expression can produce. Only the parts Vue turns into classes are read: string
 * literals, template text and its interpolations, array elements, object keys (not their boolean values),
 * the result branches of a conditional (not its test), the right side of `&&`, both sides of `||`, `??` and
 * string concatenation. Identifiers, calls and member expressions are runtime values and are skipped.
 */
const collectExpressionClasses = (node: unknown, found: IClassToken[], owner: TemplateNode): void => {
	if (node === null || typeof node !== 'object') {
		return;
	}

	const current = node as TemplateNode;

	switch (current.type) {
		case 'Literal':
			if (typeof current.value === 'string') {
				splitClasses(current.value).forEach((token) => found.push({ token, node: current }));
			}

			return;

		case 'TemplateLiteral':
			collectConcatenation(current, found, owner);

			return;

		case 'ArrayExpression':
			(current.elements as unknown[]).forEach((element) => collectExpressionClasses(element, found, owner));

			return;

		case 'ObjectExpression':
			for (const property of current.properties as TemplateNode[]) {
				if (property.type === 'SpreadElement') {
					// Object spread copies own keys: an object literal's keys are classes, but an array or a string
					// spreads index keys (`0`, `1`), and other values are unknown at lint time
					if ((property.argument as TemplateNode | undefined)?.type === 'ObjectExpression') {
						collectExpressionClasses(property.argument, found, owner);
					}

					continue;
				}

				const key = property.key as TemplateNode;

				if (property.computed === true) {
					// A computed key becomes a property name by string coercion, so it is read as a string
					collectStringClasses(key, found, owner);
				} else if (key.type === 'Identifier' && typeof key.name === 'string') {
					found.push({ token: key.name, node: key });
				} else {
					collectExpressionClasses(key, found, owner);
				}
			}

			return;

		case 'ConditionalExpression':
			collectExpressionClasses(current.consequent, found, owner);
			collectExpressionClasses(current.alternate, found, owner);

			return;

		case 'LogicalExpression':
			if (current.operator !== '&&') {
				collectExpressionClasses(current.left, found, owner);
			}

			collectExpressionClasses(current.right, found, owner);

			return;

		case 'BinaryExpression':
			if (current.operator === '+') {
				collectConcatenation(current, found, owner);
			}

			return;

		case 'SpreadElement':
		case 'TSAsExpression':
		case 'TSNonNullExpression':
			collectExpressionClasses(current.argument ?? current.expression, found, owner);

			return;

		default:
			return;
	}
};

/**
 * Classes of an operand of a concatenation or interpolation, where JavaScript turns the value into a string.
 * Only values whose text is known are read: strings, nested concatenations and the branches of conditionals
 * or logical expressions. Objects and arrays become `[object Object]` or comma-joined text, not Vue classes,
 * so they are skipped like any other runtime value.
 */
const collectStringClasses = (node: unknown, found: IClassToken[], owner: TemplateNode): void => {
	const current = node as TemplateNode | null;

	switch (current?.type) {
		case 'Literal':
			if (typeof current.value === 'string') {
				splitClasses(current.value).forEach((token) => found.push({ token, node: current }));
			}

			return;

		case 'TemplateLiteral':
			collectConcatenation(current, found, owner);

			return;

		case 'BinaryExpression':
			if (current.operator === '+') {
				collectConcatenation(current, found, owner);
			}

			return;

		case 'ConditionalExpression':
			collectStringClasses(current.consequent, found, owner);
			collectStringClasses(current.alternate, found, owner);

			return;

		case 'LogicalExpression':
			if (current.operator !== '&&') {
				collectStringClasses(current.left, found, owner);
			}

			collectStringClasses(current.right, found, owner);

			return;

		case 'TSAsExpression':
		case 'TSNonNullExpression':
			collectStringClasses(current.expression, found, owner);

			return;

		default:
			return;
	}
};

type ConcatPart = { text: string; node: TemplateNode | null } | { dynamic: unknown };

/** A `+` chain or template literal as static text and dynamic parts, in order */
const concatenationParts = (node: unknown): ConcatPart[] => {
	const current = node as TemplateNode | null;

	if (current?.type === 'BinaryExpression' && current.operator === '+') {
		return [...concatenationParts(current.left), ...concatenationParts(current.right)];
	}

	if (current?.type === 'Literal' && typeof current.value === 'string') {
		return [{ text: current.value, node: current }];
	}

	if (current?.type === 'TemplateLiteral') {
		const quasis = current.quasis as TemplateNode[];
		const expressions = current.expressions as unknown[];

		return quasis.flatMap((quasi, index) => {
			const text = (quasi.value as { cooked?: string | null } | undefined)?.cooked ?? '';
			const parts: ConcatPart[] = [{ text, node: null }];

			if (index < expressions.length) {
				parts.push(...concatenationParts(expressions[index]));
			}

			return parts;
		});
	}

	return [{ dynamic: node }];
};

/**
 * Classes of a concatenation. Adjacent static text is joined first, so `'text-' + 'primary'` is read as
 * `text-primary`. A token that touches a dynamic part (`'text-' + tone`) is incomplete and is not checked,
 * and a dynamic part is only read when whitespace separates it from the text around it.
 */
const collectConcatenation = (node: TemplateNode, found: IClassToken[], owner: TemplateNode): void => {
	const merged: ConcatPart[] = [];

	// Empty text (the quasis around `${x}`) does not touch anything, so it is left out
	for (const part of concatenationParts(node).filter((item) => !('text' in item) || item.text !== '')) {
		const previous = merged[merged.length - 1];

		if ('text' in part && previous && 'text' in previous) {
			merged[merged.length - 1] = { text: previous.text + part.text, node: null };
		} else {
			merged.push(part);
		}
	}

	merged.forEach((part, index) => {
		const previous = merged[index - 1];
		const next = merged[index + 1];

		if ('dynamic' in part) {
			const openBefore = previous !== undefined && (!('text' in previous) || !/\s$/.test(previous.text));
			const openAfter = next !== undefined && (!('text' in next) || !/^\s/.test(next.text));

			if (!openBefore && !openAfter) {
				collectStringClasses(part.dynamic, found, owner);
			}

			return;
		}

		const tokens = splitClasses(part.text);

		if (previous !== undefined && !/^\s/.test(part.text)) {
			tokens.shift();
		}

		if (next !== undefined && !/\s$/.test(part.text)) {
			tokens.pop();
		}

		tokens.forEach((token) => found.push({ token, node: part.node ?? owner }));
	});
};

const isClassAttributeName = (name: string): boolean => name === 'class' || name.endsWith('-class') || name.endsWith('Class');

/** Classes of one template attribute, static or bound */
const attributeClasses = (attribute: TemplateNode): IClassToken[] => {
	const found: IClassToken[] = [];

	if (attribute.directive === true) {
		const key = attribute.key as { name?: { name?: string }; argument?: { type: string; name?: string } | null };

		if (key.name?.name !== 'bind' || key.argument?.type !== 'VIdentifier' || !isClassAttributeName(key.argument.name ?? '')) {
			return found;
		}

		const value = attribute.value as { expression?: unknown } | null;

		collectExpressionClasses(value?.expression, found, attribute);

		return found;
	}

	const key = attribute.key as { name?: string };
	const value = attribute.value as (TemplateNode & { value?: string }) | null;

	if (!isClassAttributeName(key.name ?? '') || !value || typeof value.value !== 'string') {
		return found;
	}

	splitClasses(value.value).forEach((token) => found.push({ token, node: value }));

	return found;
};

const templateVisitor = (context: Rule.RuleContext, visitor: Record<string, (node: TemplateNode) => void>): Rule.RuleListener => {
	const services = context.sourceCode.parserServices as IParserServices | undefined;

	if (typeof services?.defineTemplateBodyVisitor !== 'function') {
		return {};
	}

	return services.defineTemplateBodyVisitor(visitor);
};

/** A rule that checks each class token of the template */
const classRule = (
	description: string,
	messages: Record<string, string>,
	check: (token: string) => { messageId: string; data?: Record<string, string> } | null
): Rule.RuleModule => ({
	meta: {
		type: 'suggestion',
		docs: { description, url: 'https://github.com/FastyBird/smart-panel/blob/main/docs/admin-ui-design-spec.md#3-unocss-and-lint' },
		schema: [],
		messages,
	},
	create: (context) =>
		templateVisitor(context, {
			VAttribute(attribute: TemplateNode): void {
				for (const { token, node } of attributeClasses(attribute)) {
					const problem = check(token);

					if (problem) {
						context.report({ loc: node.loc, messageId: problem.messageId, data: { token, ...problem.data } });
					}
				}
			},
		}),
});

const noGrayUtilities = classRule(
	'Disallow gray-* utilities; use the theme text, fill and border shortcuts',
	{ gray: '`{{token}}` uses the gray palette. Use a theme shortcut such as text-default, text-secondary, bg-fill or border-light.' },
	// Classes with an exact replacement are reported by no-deprecated-classes instead
	(token) => (GRAY_UTILITY.test(token) && !Object.hasOwn(DEPRECATED_CLASSES, bareClass(token)) ? { messageId: 'gray' } : null)
);

const noThemeOpacity = classRule(
	'Disallow opacity modifiers on theme colours; they render solid',
	{ opacity: '`{{token}}` renders solid: theme colours are CSS variables. Use a *-soft shortcut such as bg-primary-soft.' },
	(token) => (THEME_OPACITY.test(token) ? { messageId: 'opacity' } : null)
);

const noDeprecatedClasses = classRule(
	'Disallow the classes listed in DEPRECATED_CLASSES',
	{ deprecated: '`{{token}}` is deprecated. Use `{{replacement}}`.' },
	(token) => {
		const name = bareClass(token);
		// Own keys only: `constructor` or `toString` are classes, not inherited map entries
		const replacement = Object.hasOwn(DEPRECATED_CLASSES, name) ? DEPRECATED_CLASSES[name] : undefined;

		return replacement ? { messageId: 'deprecated', data: { replacement } } : null;
	}
);

const noLegacyBreakpoints = classRule(
	'Disallow the md, lg and xl breakpoints in layout classes; use the size classes',
	{ breakpoint: '`{{token}}` uses a Bootstrap breakpoint. Use the size classes tp, tl, dt or wd.' },
	(token) => (LEGACY_BREAKPOINT.test(token) ? { messageId: 'breakpoint' } : null)
);

const noPrimaryBodyText: Rule.RuleModule = {
	meta: {
		type: 'suggestion',
		docs: { description: 'Disallow text-primary on paragraphs; body text is text-default or text-regular' },
		schema: [],
		messages: { body: '`text-primary` is the blue accent, not body text. Use text-default or text-regular, or text-link for a link.' },
	},
	create: (context) =>
		templateVisitor(context, {
			'VElement[rawName="p"] > VStartTag > VAttribute'(attribute: TemplateNode): void {
				for (const { token, node } of attributeClasses(attribute)) {
					if (bareClass(token) === 'text-primary') {
						context.report({ loc: node.loc, messageId: 'body' });
					}
				}
			},
		}),
};

const noCardShadow: Rule.RuleModule = {
	meta: {
		type: 'suggestion',
		docs: { description: 'Disallow shadow="hover" and shadow="always" on el-card; cards are flat' },
		schema: [],
		messages: { shadow: 'Cards are flat. Remove `shadow="{{value}}"` (the theme renders every card with shadow="never").' },
	},
	create: (context) =>
		templateVisitor(context, {
			VAttribute(attribute: TemplateNode): void {
				const element = (attribute.parent as { parent?: { rawName?: string } } | undefined)?.parent;

				if (!element?.rawName || !['el-card', 'ElCard'].includes(element.rawName)) {
					return;
				}

				let value: string | undefined;

				if (attribute.directive === true) {
					const key = attribute.key as { name?: { name?: string }; argument?: { name?: string } | null };
					const expression = (attribute.value as { expression?: { type: string; value?: unknown } } | null)?.expression;

					if (
						key.name?.name === 'bind' &&
						key.argument?.name === 'shadow' &&
						expression?.type === 'Literal' &&
						typeof expression.value === 'string'
					) {
						value = expression.value;
					}
				} else if ((attribute.key as { name?: string }).name === 'shadow') {
					value = (attribute.value as { value?: string } | null)?.value;
				}

				if (value === 'hover' || value === 'always') {
					context.report({ loc: attribute.loc, messageId: 'shadow', data: { value } });
				}
			},
		}),
};

const documentFragment = (context: Rule.RuleContext): IDocumentFragment | null =>
	(context.sourceCode.parserServices as IParserServices | undefined)?.getDocumentFragment?.() ?? null;

interface IStyleBlock {
	start: number;
	end: number;
	/** SCSS, Sass, Less and Stylus also have `//` line comments */
	lineComments: boolean;
	/** Sass (indented) and Stylus: rules have no braces, a line is a selector or a declaration */
	indented: boolean;
}

/** The bodies of the `<style>` blocks, from the parsed SFC */
const styleBlocks = (context: Rule.RuleContext): IStyleBlock[] =>
	(documentFragment(context)?.children ?? [])
		.filter((child) => child.type === 'VElement' && child.name === 'style' && child.startTag && child.endTag)
		.map((child) => {
			const lang = child.startTag?.attributes?.find((attribute) => attribute.directive !== true && attribute.key?.name === 'lang')?.value?.value;

			return {
				start: child.startTag!.range[1],
				end: child.endTag!.range[0],
				lineComments: typeof lang === 'string' && ['scss', 'sass', 'less', 'styl', 'stylus'].includes(lang.toLowerCase()),
				indented: typeof lang === 'string' && ['sass', 'styl', 'stylus'].includes(lang.toLowerCase()),
			};
		});

/**
 * The code of a style block with comments, quoted strings and `url(…)` contents blanked out (same length, so
 * offsets stay valid). Colours are only looked for, and selectors only recognised, in what remains.
 */
const cssCode = (text: string, block: IStyleBlock): string => {
	const chars = text.slice(block.start, block.end).split('');
	const blank = (from: number, to: number): void => {
		for (let index = from; index < to; index++) {
			if (chars[index] !== '\n') {
				chars[index] = ' ';
			}
		}
	};

	let index = 0;

	while (index < chars.length) {
		const char = chars[index];
		const rest = (length: number): string => chars.slice(index, index + length).join('');

		if (char === '"' || char === "'") {
			let stop = index + 1;

			while (stop < chars.length && chars[stop] !== char && chars[stop] !== '\n') {
				stop += chars[stop] === '\\' ? 2 : 1;
			}

			blank(index, Math.min(stop + 1, chars.length));
			index = stop + 1;
		} else if (rest(2) === '/*') {
			const close = chars.join('').indexOf('*/', index + 2);
			const stop = close === -1 ? chars.length : close + 2;

			blank(index, stop);
			index = stop;
		} else if (block.lineComments && rest(2) === '//') {
			const close = chars.indexOf('\n', index);
			const stop = close === -1 ? chars.length : close;

			blank(index, stop);
			index = stop;
		} else if (/^url\(/i.test(rest(4)) && !/[\w-]/.test(chars[index - 1] ?? '')) {
			// url(#gradient), url(data:…): references, not colours. A quoted argument is a string and is blanked above.
			let open = index + 4;

			while (open < chars.length && /\s/.test(chars[open] ?? '')) {
				open++;
			}

			if (chars[open] === '"' || chars[open] === "'") {
				index = open;
			} else {
				const close = chars.indexOf(')', open);
				const stop = close === -1 ? chars.length : close;

				blank(open, stop);
				index = stop + 1;
			}
		} else {
			index++;
		}
	}

	return chars.join('');
};

/** Whether the hash at `offset` of the code is followed by `{` before any `;` or `}`, which makes it part of a selector */
/** At-rules whose prelude is a selector: `@extend #abc;`, `@at-root #abc { … }` */
const SELECTOR_AT_RULES = ['extend', 'at-root'];

/**
 * Whether the hash at `offset` of the code is part of a selector rather than a value.
 *
 * - The statement it belongs to starts after the last `{`, `}` or `;` (or, in indented syntax, at its line).
 * - An at-rule prelude is a value (`@supports (color: #fff)`), except for `@extend` and `@at-root`.
 * - Indented syntax: a line is a declaration when it starts with `property:`; any other line is a selector.
 * - Otherwise the hash is in a selector when `{` follows before the statement ends with `;` or `}`.
 */
const isCssSelectorHash = (code: string, offset: number, indented: boolean): boolean => {
	const before = code.slice(0, offset);
	const statementStart = indented
		? before.lastIndexOf('\n') + 1
		: Math.max(before.lastIndexOf('{'), before.lastIndexOf('}'), before.lastIndexOf(';')) + 1;
	const prelude = before.slice(statementStart).trimStart();
	const atRule = /^@([\w-]+)/.exec(prelude);

	if (atRule) {
		return SELECTOR_AT_RULES.includes((atRule[1] ?? '').toLowerCase());
	}

	if (indented) {
		return !/^[\w-]+\s*:/.test(prelude);
	}

	const rest = code.slice(offset);
	const brace = rest.search(/[{;}]/);

	return brace !== -1 && rest[brace] === '{';
};

const within = (index: number, ranges: [number, number][]): boolean => ranges.some(([start, end]) => index >= start && index < end);

/** `issue #123`, `PR #1234`, `Fixes #123`: a number after a reference word in text or script, never in CSS */
const ISSUE_REFERENCE = /\b(?:issues?|prs?|pull requests?|tickets?|fixes|fixed|closes|closed|refs?|see)\s*$/i;

/** Fragment references in the template and script: href="#top", :href="'#top'", :to="`#top`", url(#gradient) */
const FRAGMENT_REFERENCE = /(?:\b(?:href|to)\s*=\s*["'](?:\s*['"`])?|\burl\(\s*['"]?)$/i;

const noHexColours: Rule.RuleModule = {
	meta: {
		type: 'suggestion',
		docs: { description: 'Disallow hex colours in Vue files; use theme tokens' },
		schema: [],
		messages: { hex: '`{{value}}` is a hex colour. Use a theme variable such as var(--el-color-danger) or a theme utility.' },
	},
	create: (context) => ({
		Program(): void {
			const text = context.sourceCode.text;
			const blocks = styleBlocks(context);
			const styles = blocks.map((block): [number, number] => [block.start, block.end]);
			const comments: [number, number][] = [
				...context.sourceCode.getAllComments().map((comment) => comment.range as [number, number]),
				...(documentFragment(context)?.comments ?? []).map((comment) => comment.range),
			];

			const report = (index: number, value: string): void =>
				context.report({
					loc: { start: context.sourceCode.getLocFromIndex(index), end: context.sourceCode.getLocFromIndex(index + value.length) },
					messageId: 'hex',
					data: { value },
				});

			// Template and script
			for (const match of text.matchAll(HEX_COLOUR)) {
				const value = match[0];
				const index = match.index;
				const before = text.slice(Math.max(0, index - 30), index);

				if (within(index, styles) || within(index, comments) || FRAGMENT_REFERENCE.test(before)) {
					continue;
				}

				// Issue references, never in style attributes
				if (/^#\d{3,4}$/.test(value) && !/style=["'][^"']*$/.test(before) && ISSUE_REFERENCE.test(before)) {
					continue;
				}

				report(index, value);
			}

			// Style blocks: only their code, and only declaration values, not selectors
			for (const block of blocks) {
				const code = cssCode(text, block);

				for (const match of code.matchAll(HEX_COLOUR)) {
					if (!isCssSelectorHash(code, match.index, block.indented)) {
						report(block.start + match.index, match[0]);
					}
				}
			}
		},
	}),
};

export const designSystemRules = {
	'no-hex-colors': noHexColours,
	'no-gray-utilities': noGrayUtilities,
	'no-theme-opacity': noThemeOpacity,
	'no-primary-body-text': noPrimaryBodyText,
	'no-card-shadow': noCardShadow,
	'no-deprecated-classes': noDeprecatedClasses,
	'no-legacy-breakpoints': noLegacyBreakpoints,
} satisfies Record<string, Rule.RuleModule>;

export const designSystemPlugin = {
	meta: { name: 'fb-design' },
	rules: designSystemRules,
};

/** Every rule at one severity, for eslint.config.ts */
export const designSystemRuleLevels = (level: 'warn' | 'error' | 'off'): Record<string, 'warn' | 'error' | 'off'> =>
	Object.fromEntries(Object.keys(designSystemRules).map((name) => [`fb-design/${name}`, level]));
