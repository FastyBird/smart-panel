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
	/(?:^|[:(!])(?:text|bg|border(?:-[trblxyse])?|fill|stroke|ring(?:-offset)?|divide|outline|placeholder|from|via|to|decoration|caret|accent|shadow)-gray-\d+/;
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
			for (const element of current.elements as (TemplateNode | null)[]) {
				if (element?.type === 'SpreadElement') {
					// Array spread iterates its operand: an array literal yields its items, a string its characters,
					// other values are unknown at lint time
					if ((element.argument as TemplateNode | undefined)?.type === 'ArrayExpression') {
						collectExpressionClasses(element.argument, found, owner);
					}

					continue;
				}

				collectExpressionClasses(element, found, owner);
			}

			return;

		case 'ObjectExpression': {
			// Later keys override earlier ones (`{ ...{ 'text-primary': true }, 'text-primary': false }`), so
			// statically named keys are resolved first and only those left enabled are read
			const keys = new Map<string, TemplateNode | null>();

			resolveObjectKeys(current, keys, found, owner);

			keys.forEach((key, name) => {
				if (key) {
					splitClasses(name).forEach((token) => found.push({ token, node: key }));
				}
			});

			return;
		}

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

		case 'TSAsExpression':
		case 'TSSatisfiesExpression':
		case 'TSNonNullExpression':
			collectExpressionClasses(current.argument ?? current.expression, found, owner);

			return;

		default:
			return;
	}
};

/**
 * The keys of an object literal Vue turns into classes, in property order. A statically named key maps to its
 * node, or to null when its value is statically falsy (`false`, `null`, `0`, `''`), so a later property
 * overrides an earlier one. Computed keys are runtime names and their classes are collected directly.
 */
const resolveObjectKeys = (object: TemplateNode, keys: Map<string, TemplateNode | null>, found: IClassToken[], owner: TemplateNode): void => {
	for (const property of object.properties as TemplateNode[]) {
		if (property.type === 'SpreadElement') {
			// Object spread copies own keys: an object literal's keys are classes, but an array or a string
			// spreads index keys (`0`, `1`), and other values are unknown at lint time
			if ((property.argument as TemplateNode | undefined)?.type === 'ObjectExpression') {
				resolveObjectKeys(property.argument as TemplateNode, keys, found, owner);
			}

			continue;
		}

		const key = property.key as TemplateNode;
		const value = unwrapTypeScript((property.value as TemplateNode | undefined) ?? null);

		const name = property.computed === true ? staticComputedName(key) : key.type === 'Identifier' ? key.name : key.value;

		if (property.computed === true && name === null) {
			// A runtime computed key becomes a property name by string coercion, so it is read as a string,
			// unless its value statically disables it (`{ [tone]: false }`)
			if (!(value?.type === 'Literal' && !value.value)) {
				collectStringClasses(key, found, owner);
			}

			continue;
		}

		if (typeof name !== 'string' && typeof name !== 'number') {
			continue;
		}

		keys.delete(String(name));
		keys.set(String(name), value?.type === 'Literal' && !value.value ? null : key);
	}
};

/** `('primary' as const)`, `(x satisfies T)`, `x!`: the expression inside TypeScript wrappers */
const unwrapTypeScript = (node: TemplateNode | null): TemplateNode | null => {
	let current = node;

	while (current?.type === 'TSAsExpression' || current?.type === 'TSSatisfiesExpression' || current?.type === 'TSNonNullExpression') {
		current = current.expression as TemplateNode;
	}

	return current;
};

/** The name of a computed key known at lint time (`['text-primary']`, `['text-' + 'primary']`, `[['a', 'b']]`), or null */
const staticComputedName = (wrapped: TemplateNode): string | null => {
	const key = unwrapTypeScript(wrapped) as TemplateNode;

	if (key.type === 'Literal' && (typeof key.value === 'string' || typeof key.value === 'number')) {
		return String(key.value);
	}

	if (key.type === 'ArrayExpression') {
		return staticArrayText(key);
	}

	if (key.type === 'TemplateLiteral' || (key.type === 'BinaryExpression' && key.operator === '+')) {
		// `['text-' + 'primary']`, `` [`text-${'primary'}`] ``: known when every part is static text
		const parts = concatenationParts(key);

		return parts.every((part) => 'text' in part) ? parts.map((part) => ('text' in part ? part.text : '')).join('') : null;
	}

	return null;
};

/** `['a b', 'c']` as JavaScript turns it into a string (`a b,c`), or null when an item is not a string literal */
const staticArrayText = (node: TemplateNode): string | null => {
	const elements = node.elements as (TemplateNode | null)[];

	return elements.every((element) => element?.type === 'Literal' && typeof element.value === 'string')
		? (elements as TemplateNode[]).map((element) => element.value as string).join(',')
		: null;
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

		case 'ArrayExpression': {
			// `{ [['text-primary font-600']]: on }`: an array of strings becomes its items joined with commas
			const arrayText = staticArrayText(current);

			if (arrayText !== null) {
				splitClasses(arrayText).forEach((token) => found.push({ token, node: current }));
			}

			return;
		}

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
		case 'TSSatisfiesExpression':
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
	const current = unwrapTypeScript(node as TemplateNode | null);

	if (current?.type === 'BinaryExpression' && current.operator === '+') {
		return [...concatenationParts(current.left), ...concatenationParts(current.right)];
	}

	if (current?.type === 'Literal' && typeof current.value === 'string') {
		return [{ text: current.value, node: current }];
	}

	// `${['text-primary font-600']}`: an array of strings becomes its items joined with commas
	const arrayText = current?.type === 'ArrayExpression' ? staticArrayText(current) : null;

	if (current && arrayText !== null) {
		return [{ text: arrayText, node: current }];
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
 * Sass: a comment that starts its line runs over the following lines indented deeper than it, and ends before
 * the first non-empty line indented as much or less. Null when the comment does not start its line.
 */
const indentedCommentEnd = (chars: string[], index: number): number | null => {
	const lineStart = chars.lastIndexOf('\n', index - 1) + 1;
	const prefix = chars.slice(lineStart, index).join('');

	if (!/^\s*$/.test(prefix)) {
		return null;
	}

	let close = chars.indexOf('\n', index);

	while (close !== -1) {
		const next = chars.indexOf('\n', close + 1);
		const line = chars.slice(close + 1, next === -1 ? chars.length : next).join('');
		const indent = /^\s*/.exec(line)?.[0].length ?? 0;

		if (line.trim() !== '' && indent <= prefix.length) {
			break;
		}

		close = next;
	}

	return close === -1 ? chars.length : close;
};

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
			let stop = close === -1 ? chars.length : close + 2;

			// Sass: a block comment may also end where the indentation does, without `*/`
			const indentedEnd = block.indented ? indentedCommentEnd(chars, index) : null;

			if (indentedEnd !== null && indentedEnd < stop) {
				stop = indentedEnd;
			}

			blank(index, stop);
			index = stop;
		} else if (block.lineComments && rest(2) === '//') {
			const close = chars.indexOf('\n', index);
			// Sass: a comment on its own line also covers the more deeply indented lines below it
			const stop = (block.indented ? indentedCommentEnd(chars, index) : null) ?? (close === -1 ? chars.length : close);

			blank(index, stop);
			index = stop;
		} else if (rest(2) === '#{') {
			// SCSS interpolation `#{$suffix}`: its braces are not blocks, so they become parentheses
			let depth = 0;
			let stop = index + 1;

			for (; stop < chars.length; stop++) {
				if (chars[stop] === '"' || chars[stop] === "'") {
					// `#{'[data-state="}"]'}`: braces inside quoted strings do not count
					const quote = chars[stop];

					for (stop++; stop < chars.length && chars[stop] !== quote; stop++) {
						if (chars[stop] === '\\') {
							stop++;
						}
					}
				} else if (chars[stop] === '{') {
					depth += 1;
				} else if (chars[stop] === '}') {
					depth -= 1;

					if (depth === 0) {
						break;
					}
				}
			}

			chars[index + 1] = '(';

			if (stop < chars.length) {
				chars[stop] = ')';
			}

			index += 2;
		} else if (/^url\(/i.test(rest(4)) && !/[\w-]/.test(chars[index - 1] ?? '')) {
			// url(#gradient), url(data:…): references, not colours. A quoted argument is a string and is blanked above.
			let open = index + 4;

			while (open < chars.length && /\s/.test(chars[open] ?? '')) {
				open++;
			}

			if (chars[open] === '"' || chars[open] === "'") {
				index = open;
			} else {
				// `url(sprite\)#abc)`: an escaped `)` is part of the URL
				let stop = open;

				while (stop < chars.length && chars[stop] !== ')') {
					stop += chars[stop] === '\\' ? 2 : 1;
				}

				stop = Math.min(stop, chars.length);
				blank(open, stop);
				index = stop + 1;
			}
		} else {
			index++;
		}
	}

	return chars.join('');
};

/** At-rules whose prelude is a selector: `@extend #abc;`, `@at-root #abc { … }`, `@scope (#abc) to (.y) { … }` */
const SELECTOR_AT_RULES = ['extend', 'at-root', 'scope'];

/** Whether the end of `prelude` sits inside an unclosed `selector(` call, counting nested parentheses (`selector(:is(.a) > #abc)`). */
const insideSelectorFunction = (prelude: string): boolean => {
	const lower = prelude.toLowerCase();

	for (let open = lower.indexOf('selector('); open !== -1; open = lower.indexOf('selector(', open + 1)) {
		let depth = 0;

		for (const char of lower.slice(open + 'selector'.length)) {
			if (char === '(') {
				depth += 1;
			} else if (char === ')') {
				depth -= 1;

				if (depth === 0) {
					break;
				}
			}
		}

		if (depth > 0) {
			return true;
		}
	}

	return false;
};

/** Indented syntax: the start of the last line that begins outside parentheses (`color: mix(` continues on the next line) */
const indentedStatementStart = (before: string): number => {
	let depth = 0;
	let start = 0;

	for (let index = 0; index < before.length; index++) {
		const char = before[index];

		if (char === '(') {
			depth += 1;
		} else if (char === ')') {
			depth = Math.max(0, depth - 1);
		} else if (char === '\n' && depth === 0) {
			start = index + 1;
		}
	}

	return start;
};

/**
 * Whether the hash at `offset` of the code is part of a selector rather than a value.
 *
 * - The statement it belongs to starts after the last `{`, `}` or `;` (or, in indented syntax, at its line, or at the
 *   line that opened a still unclosed parenthesis).
 * - An at-rule prelude is a value (`@supports (color: #fff)`), except inside `selector(…)` and for `SELECTOR_AT_RULES`.
 * - Indented syntax: `property: value` and `name = value` are declarations; any other line followed by more
 *   deeply indented lines is a selector (`a:hover #abc`); a remaining `property:value` line is a declaration.
 * - Otherwise `property: value` is a declaration, and the hash is in a selector when `{` follows before the
 *   statement ends with `;` or `}`.
 */
const isCssSelectorHash = (code: string, offset: number, indented: boolean): boolean => {
	const before = code.slice(0, offset);
	const statementStart = indented
		? indentedStatementStart(before)
		: Math.max(before.lastIndexOf('{'), before.lastIndexOf('}'), before.lastIndexOf(';')) + 1;
	const prelude = before.slice(statementStart).trimStart();
	const atRule = /^@([\w-]+)/.exec(prelude);

	if (atRule) {
		// `@supports selector(#abc)`: the argument of selector() is a selector, whatever the at-rule
		if (insideSelectorFunction(prelude)) {
			return true;
		}

		return SELECTOR_AT_RULES.includes((atRule[1] ?? '').toLowerCase());
	}

	if (indented) {
		// `name: value` (a space after the colon) and `name = value` are declarations, also when nested
		// properties follow (`background: #fff` over `  repeat: no-repeat`); so are Sass variables `$tone: …`
		if (/^(?:\$?[\w-]+\s*:(?:\s|$)|[\w$-]+\s*=)/.test(prelude)) {
			return false;
		}

		// A line with more deeply indented lines below it opens a rule, so it is a selector (`a:hover #abc`)
		const indent = /^[ \t]*/.exec(code.slice(statementStart))?.[0].length ?? 0;
		const nextLine = code
			.slice(offset)
			.split('\n')
			.slice(1)
			.find((line) => line.trim() !== '');

		if (nextLine !== undefined && (/^[ \t]*/.exec(nextLine)?.[0].length ?? 0) > indent) {
			return true;
		}

		// Otherwise `name:value` is a declaration and anything else a selector
		return !/^\$?[\w-]+\s*:/.test(prelude);
	}

	// `name: value` is a declaration, also when nested properties follow (`background: #fff { repeat: … }`)
	if (/^\$?[\w-]+\s*:\s/.test(prelude)) {
		return false;
	}

	const rest = code.slice(offset);
	const brace = rest.search(/[{;}]/);

	return brace !== -1 && rest[brace] === '{';
};

const within = (index: number, ranges: [number, number][]): boolean => ranges.some(([start, end]) => index >= start && index < end);

/** `issue #123`, `PR #1234`, `Fixes #123`: a number after a reference word in text or script, never in CSS */
const ISSUE_REFERENCE = /\b(?:issues?|prs?|pull requests?|tickets?|fixes|fixed|closes|closed|refs?|see)\s*$/i;

/**
 * Fragment references in static text: href="#top", to="#top", url(#gradient). Bound `:href` / `:to` values are
 * resolved from the AST (`referenceRanges`), so a literal in their condition is still checked.
 */
const FRAGMENT_REFERENCE = /(?:(?<![:.\w-])(?:href|to)\s*=\s*["']|\burl\(\s*['"]?)$/i;

/** DOM methods whose first argument is a CSS selector (`document.querySelector('#abc')`) */
const SELECTOR_METHODS = ['querySelector', 'querySelectorAll', 'closest', 'matches'];

/** The text of a string or template literal, without the interpolated expressions (`` `#${expression}` ``) */
const literalTextRanges = (node: TemplateNode): [number, number][] =>
	node.type === 'TemplateLiteral' ? (node.quasis as TemplateNode[]).map((quasi) => quasi.range) : [node.range];

/** Router methods that take a location (`router.push({ hash: '#top' })`) */
const ROUTER_METHODS = ['push', 'replace', 'resolve'];

/** `router`, `this.$router`, `useRouter()`: the receiver of a router method call */
const isRouterReceiver = (node: TemplateNode | undefined): boolean => {
	if (node?.type === 'Identifier') {
		return node.name === 'router' || node.name === '$router';
	}

	if (node?.type === 'MemberExpression') {
		const property = node.property as TemplateNode;

		return node.computed !== true && property.type === 'Identifier' && (property.name === 'router' || property.name === '$router');
	}

	if (node?.type === 'CallExpression') {
		const callee = node.callee as TemplateNode;

		return callee.type === 'Identifier' && callee.name === 'useRouter';
	}

	return false;
};

/** `router.push`, `document['querySelector']`: the static name of a called method, or null */
const methodName = (callee: TemplateNode | undefined): string | null => {
	if (callee?.type !== 'MemberExpression') {
		return null;
	}

	const property = callee.property as TemplateNode;

	if (callee.computed !== true) {
		return property.type === 'Identifier' ? (property.name as string) : null;
	}

	return property.type === 'Literal' && typeof property.value === 'string' ? property.value : null;
};

/**
 * The string and template literals a bound expression can evaluate to: itself, the result branches of
 * conditional and logical expressions, and the inside of TypeScript wrappers (`:href="on ? '#a' : '#b'"`)
 */
const resultLiterals = (node: TemplateNode | null | undefined): TemplateNode[] => {
	const current = unwrapTypeScript(node ?? null);

	switch (current?.type) {
		case 'Literal':
			return typeof current.value === 'string' ? [current] : [];
		case 'TemplateLiteral':
			return [current];
		case 'ConditionalExpression':
			return [...resultLiterals(current.consequent as TemplateNode), ...resultLiterals(current.alternate as TemplateNode)];
		case 'LogicalExpression':
			return [...(current.operator === '&&' ? [] : resultLiterals(current.left as TemplateNode)), ...resultLiterals(current.right as TemplateNode)];
		default:
			return [];
	}
};

/** Whether an object literal is a router location: the value of a `to` binding or the argument of a router method */
const isRouterLocation = (object: TemplateNode, parents: Map<unknown, TemplateNode>): boolean => {
	// A result branch of a conditional or logical expression is the value of that expression
	// (`:to="docs ? { hash: '#abc' } : '/help'"`); a condition is not
	let node = object;
	let parent = parents.get(node) ?? null;

	while (
		((parent?.type === 'TSAsExpression' || parent?.type === 'TSSatisfiesExpression' || parent?.type === 'TSNonNullExpression') &&
			parent.expression === node) ||
		(parent?.type === 'ConditionalExpression' && (parent.consequent === node || parent.alternate === node)) ||
		(parent?.type === 'LogicalExpression' && (parent.right === node || (parent.operator !== '&&' && parent.left === node)))
	) {
		node = parent;
		parent = parents.get(node) ?? null;
	}

	if (parent?.type === 'VExpressionContainer') {
		const attribute = parent.parent as TemplateNode | undefined;
		const key = attribute?.key as { name?: { name?: string }; argument?: { name?: string } | null } | undefined;

		// Only `v-bind:to` / `:to`, not a custom directive argument such as `v-paint:to`
		return attribute?.type === 'VAttribute' && key?.name?.name === 'bind' && key.argument?.name === 'to';
	}

	if (parent?.type === 'CallExpression' && (parent.arguments as unknown[])[0] === node) {
		const callee = parent.callee as TemplateNode;

		return ROUTER_METHODS.includes(methodName(callee) ?? '') && isRouterReceiver(callee.object as TemplateNode | undefined);
	}

	return false;
};

/**
 * Ranges of the selector arguments of SELECTOR_METHODS calls, of string router locations (`router.push('#abc')`)
 * and of the `hash` of object router locations (`:to="{ hash: '#abc' }"`), in the script and in template expressions
 */
const referenceRanges = (context: Rule.RuleContext): [number, number][] => {
	const ranges: [number, number][] = [];
	const parents = new Map<unknown, TemplateNode>();
	const visit = (node: unknown, parent: TemplateNode | null): void => {
		if (node === null || typeof node !== 'object' || parents.has(node)) {
			return;
		}

		if (Array.isArray(node)) {
			node.forEach((item) => visit(item, parent));

			return;
		}

		const current = node as TemplateNode;

		if (parent) {
			parents.set(current, parent);
		}

		if (current.type === 'ObjectExpression' && isRouterLocation(current, parents)) {
			for (const property of current.properties as TemplateNode[]) {
				const key = property.key as TemplateNode | undefined;
				const value = property.value as TemplateNode | undefined;

				if (
					property.type === 'Property' &&
					property.computed !== true &&
					(key?.name ?? key?.value) === 'hash' &&
					(value?.type === 'Literal' || value?.type === 'TemplateLiteral')
				) {
					ranges.push(...literalTextRanges(value));
				}
			}
		}

		if (current.type === 'CallExpression') {
			const callee = current.callee as TemplateNode | undefined;
			const name = methodName(callee) ?? '';

			// `document.querySelector('#abc')`, and string locations such as `router.push('#abc' as const)`
			const selector = SELECTOR_METHODS.includes(name);
			const routerLocation = ROUTER_METHODS.includes(name) && isRouterReceiver(callee?.object as TemplateNode | undefined);

			if (selector || routerLocation) {
				resultLiterals((current.arguments as TemplateNode[] | undefined)?.[0]).forEach((literal) => ranges.push(...literalTextRanges(literal)));
			}
		}

		// `:href="active ? '#abc' : '#def'"`, `:to="'#abc'"`: the literal results of a link binding are fragments
		if (current.type === 'VAttribute' && current.directive === true) {
			const key = current.key as { name?: { name?: string }; argument?: { name?: string } | null };
			const value = current.value as { expression?: TemplateNode | null } | null;

			if (key.name?.name === 'bind' && (key.argument?.name === 'href' || key.argument?.name === 'to')) {
				resultLiterals(value?.expression).forEach((literal) => ranges.push(...literalTextRanges(literal)));
			}
		}

		for (const [key, value] of Object.entries(current)) {
			if (key !== 'parent' && key !== 'loc' && key !== 'range' && key !== 'tokens' && key !== 'comments' && key !== 'errors') {
				visit(value, current);
			}
		}
	};

	visit(context.sourceCode.ast, null);

	return ranges;
};

/** Ranges of the values of `style` and `:style` attributes, where every hash is a colour */
const styleAttributeRanges = (context: Rule.RuleContext): [number, number][] => {
	const ranges: [number, number][] = [];
	const visit = (node: TemplateNode | null | undefined): void => {
		if (!node || node.type !== 'VElement') {
			return;
		}

		const startTag = node.startTag as { attributes?: TemplateNode[] } | undefined;

		for (const attribute of startTag?.attributes ?? []) {
			const key = attribute.key as { name?: string | { name?: string }; argument?: { name?: string } | null };
			const value = attribute.value as TemplateNode | null;
			const isStyle =
				attribute.directive === true
					? typeof key.name === 'object' && key.name.name === 'bind' && key.argument?.name === 'style'
					: key.name === 'style';

			if (isStyle && value) {
				ranges.push(value.range);
			}
		}

		(node.children as TemplateNode[] | undefined)?.forEach(visit);
	};

	visit((context.sourceCode.ast as unknown as { templateBody?: TemplateNode | null }).templateBody);

	return ranges;
};

/** Ranges of `#name` slot shorthands (`<template #add>`): directive keys, not colours */
const slotShorthandRanges = (context: Rule.RuleContext): [number, number][] => {
	const ranges: [number, number][] = [];
	const visit = (node: TemplateNode | null | undefined): void => {
		if (!node || node.type !== 'VElement') {
			return;
		}

		const startTag = node.startTag as { attributes?: TemplateNode[] } | undefined;

		for (const attribute of startTag?.attributes ?? []) {
			const key = attribute.key as { name?: { rawName?: string }; range?: [number, number] } | undefined;

			if (attribute.directive === true && key?.name?.rawName === '#' && key.range) {
				ranges.push(key.range);
			}
		}

		(node.children as TemplateNode[] | undefined)?.forEach(visit);
	};

	visit((context.sourceCode.ast as unknown as { templateBody?: TemplateNode | null }).templateBody);

	return ranges;
};

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
				...slotShorthandRanges(context),
				...referenceRanges(context),
			];
			const styleAttributes = styleAttributeRanges(context);

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
				if (/^#\d+$/.test(value) && !within(index, styleAttributes) && ISSUE_REFERENCE.test(before)) {
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
