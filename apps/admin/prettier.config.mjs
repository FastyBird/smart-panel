import pluginSortImports from '@trivago/prettier-plugin-sort-imports';

export default {
	plugins: [pluginSortImports],
	importOrderParserPlugins: ['typescript', 'decorators-legacy'],
	printWidth: 150,
	tabWidth: 2,
	useTabs: true,
	semi: true,
	singleQuote: true,
	quoteProps: 'as-needed',
	jsxSingleQuote: false,
	trailingComma: 'es5',
	bracketSpacing: true,
	arrowParens: 'always',
	requirePragma: false,
	insertPragma: false,
	proseWrap: 'preserve',
	htmlWhitespaceSensitivity: 'ignore', // Ensures no conflict with template whitespace
	vueIndentScriptAndStyle: false,
	endOfLine: 'auto',
	singleAttributePerLine: true,
	importOrder: [
		// First external imports
		'^vue',
		'^pinia',
		'^[^@\\/.]',
		'^@?\\w',
		// Now internal imports, separated by space
		'^../(.*)$', // Relative imports like `../`
		'^./(.*)$', // Relative imports like `./`
	],
	importOrderSeparation: true,
	importOrderSortSpecifiers: true,
};
