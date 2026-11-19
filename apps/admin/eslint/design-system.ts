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

/** Every class name a bound expression can produce: string literals, template text and object keys */
const collectExpressionClasses = (node: unknown, found: IClassToken[], owner: TemplateNode): void => {
	if (node === null || typeof node !== 'object') {
		return;
	}

	const current = node as TemplateNode;

	if (current.type === 'Literal' && typeof current.value === 'string') {
		splitClasses(current.value).forEach((token) => found.push({ token, node: current }));

		return;
	}

	if (current.type === 'TemplateElement') {
		const value = (current.value as { cooked?: string | null } | undefined)?.cooked ?? '';

		splitClasses(value).forEach((token) => found.push({ token, node: owner }));

		return;
	}

	if (current.type === 'Property' && current.computed !== true) {
		const key = current.key as TemplateNode;

		if (key.type === 'Identifier' && typeof key.name === 'string') {
			found.push({ token: key.name, node: key });
		}

		collectExpressionClasses(key.type === 'Literal' ? key : null, found, owner);
		collectExpressionClasses(current.value, found, owner);

		return;
	}

	for (const [key, child] of Object.entries(current)) {
		if (key === 'parent' || key === 'loc' || key === 'range' || key === 'tokens' || key === 'comments') {
			continue;
		}

		if (Array.isArray(child)) {
			child.forEach((item) => collectExpressionClasses(item, found, owner));
		} else if (child !== null && typeof child === 'object' && 'type' in child) {
			collectExpressionClasses(child, found, owner);
		}
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

const isCommentLine = (line: string): boolean => /^\s*(\/\/|\/\*|\*|<!--)/.test(line);

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

			for (const match of text.matchAll(HEX_COLOUR)) {
				const value = match[0];
				const index = match.index;
				const lineStart = text.lastIndexOf('\n', index) + 1;
				const line = text.slice(lineStart, text.indexOf('\n', index) === -1 ? undefined : text.indexOf('\n', index));
				const before = text.slice(Math.max(0, index - 6), index);

				// Issue references in comments (#123) and in-page anchors (href="#add") are not colours
				if (isCommentLine(line) || /(href|to)=["']$/.test(before) || (/^#\d{3,4}$/.test(value) && /[a-z]\s$/i.test(text.slice(index - 2, index)))) {
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
