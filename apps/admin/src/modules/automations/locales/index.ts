import csCZ from './cs-CZ.json';
import deDE from './de-DE.json';
import enUS from './en-US.json';
import esES from './es-ES.json';
import plPL from './pl-PL.json';
import skSK from './sk-SK.json';

export const locales: Record<string, Record<string, unknown>> = {
	'cs-CZ': csCZ,
	'de-DE': deDE,
	'en-US': enUS,
	'es-ES': esES,
	'pl-PL': plPL,
	'sk-SK': skSK,
};
