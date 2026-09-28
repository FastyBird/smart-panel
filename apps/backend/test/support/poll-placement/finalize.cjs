// Run after archiving the final export and waiting for the writer process to exit.
// The expected owner is the retained, trusted owner record from that run.
const fs = require('node:fs');
const path = require('node:path');
const [exportPath, expectedOwnerPath] = process.argv.slice(2);
const refuse = (reason) => {
	console.error(reason);
	process.exit(1);
};
if (!exportPath || !expectedOwnerPath || !path.isAbsolute(exportPath))
	refuse('usage: finalize.cjs <absolute-export> <retained-owner>');
const readPrivate = (file) => {
	const stat = fs.lstatSync(file);
	if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o177) !== 0) refuse('foreign-or-public-file');
	return JSON.parse(fs.readFileSync(file, 'utf8'));
};
try {
	const expected = readPrivate(expectedOwnerPath);
	if (
		expected.schemaVersion !== 1 ||
		!Number.isInteger(expected.processId) ||
		expected.processId <= 1 ||
		!expected.runId ||
		!expected.processInstanceId ||
		!expected.configFingerprint
	)
		refuse('expected-owner-invalid');
	try {
		process.kill(expected.processId, 0);
		refuse('writer-still-running');
	} catch (error) {
		if (error.code !== 'ESRCH') refuse('writer-exit-unproven');
	}
	const directory = fs.lstatSync(path.dirname(exportPath));
	if (!directory.isDirectory() || directory.isSymbolicLink() || (directory.mode & 0o077) !== 0)
		refuse('directory-not-private');
	const owner = readPrivate(`${exportPath}.owner.json`);
	if (JSON.stringify(owner) !== JSON.stringify(expected)) refuse('owner-mismatch');
	try {
		const snapshot = readPrivate(exportPath);
		for (const key of ['runId', 'processId', 'processInstanceId', 'configFingerprint'])
			if (snapshot[key] !== expected[key]) refuse('export-owner-mismatch');
		fs.unlinkSync(exportPath);
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
	}
	fs.unlinkSync(`${exportPath}.owner.json`);
	const handle = fs.openSync(path.dirname(exportPath), 'r');
	try {
		fs.fsyncSync(handle);
	} finally {
		fs.closeSync(handle);
	}
	console.log('owned-export-removed');
} catch {
	refuse('cleanup-failed-closed');
}
