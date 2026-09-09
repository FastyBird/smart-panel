'use strict';

/**
 * Prints the structured failure of every failed test whose printed message is blank, so an
 * empty "●" block in CI still carries the error object jest-circus attached to the test.
 */
class FailureDetailsReporter {
	onTestFileResult(_test, testResult) {
		const blank = testResult.testResults.filter(
			(result) => result.status === 'failed' && result.failureMessages.join('').trim() === '',
		);

		if (blank.length === 0 && !testResult.testExecError) {
			return;
		}

		process.stderr.write(`\n[failure-details] ${testResult.testFilePath}\n`);

		if (testResult.testExecError) {
			process.stderr.write(`testExecError: ${JSON.stringify(testResult.testExecError, null, 2)}\n`);
		}

		for (const result of blank) {
			process.stderr.write(`${result.fullName}\n${JSON.stringify(result.failureDetails, null, 2)}\n`);
		}
	}
}

module.exports = FailureDetailsReporter;
