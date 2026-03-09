export function printStep(msg: string): void {
	console.log(`  \x1b[34m→\x1b[0m ${msg}`);
}

export function printSuccess(msg: string): void {
	console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}

export function printWarning(msg: string): void {
	console.log(`  \x1b[33m!\x1b[0m ${msg}`);
}

export function printError(msg: string): void {
	console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
}
