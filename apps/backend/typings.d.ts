declare module '*.json' {
	const value: any;
	export default value;
}

// Optional AI SDK modules — loaded dynamically at runtime
declare module '@anthropic-ai/sdk' {
	const Anthropic: any;
	export default Anthropic;
}

declare module 'openai' {
	const OpenAI: any;
	export default OpenAI;
}
