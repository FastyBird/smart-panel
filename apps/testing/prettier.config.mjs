import pluginSortImports from '@trivago/prettier-plugin-sort-imports';

export default {
	plugins: [pluginSortImports],
	importOrderParserPlugins: ['typescript', 'jsx'],
	printWidth: 120,
	tabWidth: 2,
	useTabs: true,
	semi: true,
	singleQuote: true,
	quoteProps: 'as-needed',
	jsxSingleQuote: false,
	trailingComma: 'all',
	bracketSpacing: true,
	arrowParens: 'always',
	requirePragma: false,
	insertPragma: false,
	proseWrap: 'preserve',
	endOfLine: 'auto',
	singleAttributePerLine: true,
	importOrder: [
		// First external imports
		'^[^@\\/.]',
		'^@?\\w',
		// Now internal imports, separated by space
		'^../(.*)$',
		'^./(.*)$',
	],
	importOrderSeparation: true,
	importOrderSortSpecifiers: true,
};
