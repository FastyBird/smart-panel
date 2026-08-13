import { HomeyEvent } from '../models/homey-event.model';

export type HomeyEventListener = (event: HomeyEvent) => Promise<void> | void;

/** Cleanup callbacks must remain safe when invoked more than once. */
export type HomeyUnsubscribe = () => Promise<void> | void;
