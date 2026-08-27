'use strict';

const AVAILABILITY_SETTING_ID = 'fbsp_lifecycle_availability';

const applyAvailabilitySetting = async ({ changedKeys, makeAvailable, makeUnavailable, newSettings }) => {
	if (!changedKeys.includes(AVAILABILITY_SETTING_ID)) {
		return;
	}

	switch (newSettings[AVAILABILITY_SETTING_ID]) {
		case 'available':
			await makeAvailable();
			break;
		case 'unavailable':
			await makeUnavailable();
			break;
		default:
			throw new Error('Unsupported lifecycle availability setting');
	}
};

module.exports = {
	AVAILABILITY_SETTING_ID,
	applyAvailabilitySetting,
};
