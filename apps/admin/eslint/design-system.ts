/*
 * Design system lint rules for the admin (docs/admin-ui-design-spec.md, section 3).
 *
 * The rules read the classes of Vue templates (static `class` and `*-class` attributes, and the string
 * literals and object keys of their bound `:class` expressions) and, for hex colours, the whole `.vue` file.
 * `eslint.config.ts` decides where they warn and where they are errors.
 */
import type { AST, Rule } from 'eslint';

import { DEPRECATED_CLASSES } from '../uno.theme';

type TemplateNode = { type: string; range: [number, number]; loc: AST.SourceLocation } & Record<string, unknown>;

interface IClassToken {
	token: string;
	node: TemplateNode;
}

interface IParserServices {
	defineTemplateBodyVisitor?: (templateVisitor: Record<string, (node: TemplateNode) => void>, scriptVisitor?: Rule.RuleListener) => Rule.RuleListener;
}

const THEME_COLOURS = '(?:primary|success|warning|danger|info|brand)';

const GRAY_UTILITY = /(?:^|[:(!])(?:text|bg|border|fill|stroke|ring|divide|outline|placeholder|from|via|to|decoration|caret|accent)-gray-\d+/;
const THEME_OPACITY = new RegExp(`(?:^|[:(!])(?:bg|text|border|fill)-${THEME_COLOURS}\\/\\d+`);
const LEGACY_BREAKPOINT = /(?:^|[:(])(?:md|lg|xl):/;
const HEX_COLOUR = /(?<![\w&/#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;

/** `dark:hover:!bg-gray-50!` → `bg-gray-50`; variant groups lose their parentheses */
const bareClass = (token: string): string => {
	const withoutGroup = token.replace(/[()]/g, '');
	const withoutVariants = withoutGroup.slice(withoutGroup.lastIndexOf(':') + 1);

	return withoutVariants.replace(/^!|!$/g, '');
};

const splitClasses = (value: string): string[] => value.split(/\s+/).filter((token) => token.length > 0);

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
			for (const quasi of current.quasis as TemplateNode[]) {
				const value = (quasi.value as { cooked?: string | null } | undefined)?.cooked ?? '';

				splitClasses(value).forEach((token) => found.push({ token, node: owner }));
			}

			(current.expressions as unknown[]).forEach((expression) => collectExpressionClasses(expression, found, owner));

			return;

		case 'ArrayExpression':
			(current.elements as unknown[]).forEach((element) => collectExpressionClasses(element, found, owner));

			return;

		case 'ObjectExpression':
			for (const property of current.properties as TemplateNode[]) {
				if (property.type === 'SpreadElement') {
					collectExpressionClasses(property.argument, found, owner);

					continue;
				}

				const key = property.key as TemplateNode;

				if (property.computed === true) {
					collectExpressionClasses(key, found, owner);
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
				collectExpressionClasses(current.left, found, owner);
				collectExpressionClasses(current.right, found, owner);
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
	(token) => (GRAY_UTILITY.test(token) && !(bareClass(token) in DEPRECATED_CLASSES) ? { messageId: 'gray' } : null)
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
		const replacement = DEPRECATED_CLASSES[bareClass(token)];

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

/** Character ranges of comments: HTML comments, script comments from the parser, CSS comments in style blocks */
const commentRanges = (context: Rule.RuleContext, text: string): [number, number][] => {
	const ranges: [number, number][] = context.sourceCode.getAllComments().map((comment) => comment.range as [number, number]);

	for (const match of text.matchAll(/<!--[\s\S]*?-->/g)) {
		ranges.push([match.index, match.index + match[0].length]);
	}

	for (const block of styleRanges(text)) {
		for (const match of text.slice(block[0], block[1]).matchAll(/\/\*[\s\S]*?\*\//g)) {
			ranges.push([block[0] + match.index, block[0] + match.index + match[0].length]);
		}
	}

	return ranges;
};

/** Character ranges of the bodies of `<style>` blocks */
const styleRanges = (text: string): [number, number][] =>
	[...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((match) => {
		const start = match.index + match[0].indexOf('>') + 1;

		return [start, start + (match[1] ?? '').length];
	});

const within = (index: number, ranges: [number, number][]): boolean => ranges.some(([start, end]) => index >= start && index < end);

/** `issue #123`, `PR #1234`, `Fixes #123`: a number after a reference word in text or script, never in CSS */
const ISSUE_REFERENCE = /\b(?:issues?|prs?|pull requests?|tickets?|fixes|fixed|closes|closed|refs?|see)\s*$/i;

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
			const comments = commentRanges(context, text);
			const styles = styleRanges(text);

			for (const match of text.matchAll(HEX_COLOUR)) {
				const value = match[0];
				const index = match.index;
				const before = text.slice(Math.max(0, index - 30), index);

				if (within(index, comments)) {
					continue;
				}

				// In-page anchors (href="#add", to="#top") are not colours
				if (/(?:href|to)=["']$/.test(before)) {
					continue;
				}

				// Issue references, outside style blocks and style attributes
				if (/^#\d{3,4}$/.test(value) && !within(index, styles) && !/style=["'][^"']*$/.test(before) && ISSUE_REFERENCE.test(before)) {
					continue;
				}

				context.report({
					loc: { start: context.sourceCode.getLocFromIndex(index), end: context.sourceCode.getLocFromIndex(index + value.length) },
					messageId: 'hex',
					data: { value },
				});
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
