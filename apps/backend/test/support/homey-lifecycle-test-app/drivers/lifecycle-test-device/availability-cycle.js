'use strict';

const UNAVAILABLE_DELAY_MS = 30_000;
const RESTORE_DELAY_MS = 15_000;

const scheduleAvailabilityCycle = ({
	cancel = clearTimeout,
	makeAvailable,
	makeUnavailable,
	onError,
	schedule = setTimeout,
}) => {
	let restoreTimer = null;
	let stopped = false;
	const reportError = (error) => {
		if (!stopped) {
			onError(error);
		}
	};

	const unavailableTimer = schedule(() => {
		if (stopped) {
			return;
		}

		Promise.resolve()
			.then(makeUnavailable)
			.then(() => {
				if (stopped) {
					return;
				}

				restoreTimer = schedule(() => {
					if (stopped) {
						return;
					}

					Promise.resolve().then(makeAvailable).catch(reportError);
				}, RESTORE_DELAY_MS);
			})
			.catch(reportError);
	}, UNAVAILABLE_DELAY_MS);

	return () => {
		stopped = true;
		cancel(unavailableTimer);

		if (restoreTimer !== null) {
			cancel(restoreTimer);
		}
	};
};

module.exports = {
	RESTORE_DELAY_MS,
	UNAVAILABLE_DELAY_MS,
	scheduleAvailabilityCycle,
};
