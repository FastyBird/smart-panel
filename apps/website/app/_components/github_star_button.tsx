"use client";

import GitHubButton from "react-github-btn";

interface GitHubStarButtonProps {
	href: string;
	ariaLabel: string;
	children: React.ReactNode;
}

export const GitHubStarButton = ({ href, ariaLabel, children }: GitHubStarButtonProps) => {
	return (
		<GitHubButton href={href} data-size="large" data-show-count="true" aria-label={ariaLabel}>
			{children}
		</GitHubButton>
	);
};
