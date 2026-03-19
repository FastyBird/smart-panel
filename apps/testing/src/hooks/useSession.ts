import { useCallback, useEffect, useRef, useState } from 'react';

import type { Orientation, Status, TestSession } from '../types';
import { buildResultKey } from '../utils';

const STORAGE_KEY = 'smart-panel-test-session';
const DEBOUNCE_MS = 500;

export function useSession() {
	// Synchronous init from localStorage — avoids race condition with useEffect
	const [session, setSession] = useState<TestSession | null>(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				return JSON.parse(stored) as TestSession;
			} catch {
				localStorage.removeItem(STORAGE_KEY);
				return null;
			}
		}
		return null;
	});
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Keep a ref to current session for the beforeunload handler
	const sessionRef = useRef(session);
	useEffect(() => {
		sessionRef.current = session;
	}, [session]);

	// Debounced save — sync ref immediately so beforeunload always has latest
	const save = useCallback((updated: TestSession) => {
		sessionRef.current = updated;
		setSession(updated);
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
		}, DEBOUNCE_MS);
	}, []);

	// Flush on unload to prevent data loss from debounce window
	useEffect(() => {
		const flush = () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				const current = sessionRef.current;
				if (current) {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
				}
			}
		};
		window.addEventListener('beforeunload', flush);
		return () => window.removeEventListener('beforeunload', flush);
	}, []);

	const startSession = useCallback((newSession: TestSession) => {
		sessionRef.current = newSession;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
		setSession(newSession);
	}, []);

	const updateResult = useCallback(
		(configId: string, testId: string, orientation: Orientation, status: Status) => {
			const current = sessionRef.current;
			if (!current) return;
			const key = buildResultKey(configId, testId, orientation);
			const updated: TestSession = {
				...current,
				results: {
					...current.results,
					[key]: {
						status,
						notes: current.results[key]?.notes ?? '',
						updatedAt: new Date().toISOString(),
					},
				},
			};
			save(updated);
		},
		[save],
	);

	const updateNotes = useCallback(
		(configId: string, testId: string, orientation: Orientation, notes: string) => {
			const current = sessionRef.current;
			if (!current) return;
			const key = buildResultKey(configId, testId, orientation);
			const existing = current.results[key] ?? {
				status: 'pending' as const,
				notes: '',
				updatedAt: new Date().toISOString(),
			};
			const updated: TestSession = {
				...current,
				results: {
					...current.results,
					[key]: { ...existing, notes, updatedAt: new Date().toISOString() },
				},
			};
			save(updated);
		},
		[save],
	);

	const resetSession = useCallback(() => {
		localStorage.removeItem(STORAGE_KEY);
		setSession(null);
	}, []);

	return {
		session,
		hasExistingSession: session !== null,
		startSession,
		updateResult,
		updateNotes,
		resetSession,
	};
}
