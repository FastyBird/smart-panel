'use client';

import { useEffect, useState } from 'react';

const CONSENT_STORAGE_KEY = 'fastybird-cookie-consent';
const ANALYTICS_SCRIPT_ID = 'fastybird-umami-script';

type ConsentValue = 'accepted' | 'declined';

const getStoredConsent = (): ConsentValue | null => {
	try {
		const storedConsent = window.localStorage?.getItem(CONSENT_STORAGE_KEY);

		return storedConsent === 'accepted' || storedConsent === 'declined' ? storedConsent : null;
	} catch {
		return null;
	}
};

const storeConsent = (value: ConsentValue) => {
	try {
		window.localStorage?.setItem(CONSENT_STORAGE_KEY, value);
	} catch {
		// Browsers can block storage; the current page can still honor the selected choice.
	}
};

const addAnalyticsScript = () => {
	if (document.getElementById(ANALYTICS_SCRIPT_ID)) {
		return;
	}

	const script = document.createElement('script');

	script.id = ANALYTICS_SCRIPT_ID;
	script.defer = true;
	script.src = 'https://analytics.studio81.cz/script.js';
	script.dataset.websiteId = 'a4756197-5ee3-4948-9a6b-ce3f1dba416b';

	document.body.appendChild(script);
};

export const CookieConsent = () => {
	const [consent, setConsent] = useState<ConsentValue | null>(null);
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		const storedConsent = getStoredConsent();

		if (storedConsent !== null) {
			setConsent(storedConsent);
		}

		setIsReady(true);
	}, []);

	useEffect(() => {
		if (consent === 'accepted') {
			addAnalyticsScript();
		}
	}, [consent]);

	const updateConsent = (value: ConsentValue) => {
		storeConsent(value);
		setConsent(value);
	};

	if (!isReady || consent !== null) {
		return null;
	}

	return (
		<div className="fixed inset-x-3 bottom-3 z-[70] flex justify-center sm:inset-x-5 sm:bottom-5">
			<section
				aria-label="Cookie consent"
				className="w-full max-w-[520px] rounded-lg border border-neutral-200 bg-white/95 p-4 text-neutral-900 shadow-[0_16px_48px_rgba(15,23,42,0.18)] backdrop-blur dark:border-white/10 dark:bg-[#141921]/95 dark:text-white"
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm leading-6 text-neutral-600 dark:text-[#a8b2c7]">
						We use privacy-friendly analytics to understand site usage. You can accept or decline optional
						analytics cookies.
					</p>
					<div className="flex shrink-0 items-center gap-2">
						<button
							type="button"
							className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e85a4f] dark:border-white/15 dark:text-white/70 dark:hover:border-white/30 dark:hover:text-white"
							onClick={() => updateConsent('declined')}
						>
							Decline
						</button>
						<button
							type="button"
							className="rounded-full bg-[#e85a4f] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#d44f45] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e85a4f] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#141921]"
							onClick={() => updateConsent('accepted')}
						>
							Accept
						</button>
					</div>
				</div>
			</section>
		</div>
	);
};
