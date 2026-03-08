"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";

interface FeatureCardProps {
	icon: ReactNode;
	title: string;
	description: string;
	variant?: "light" | "dark";
}

export const FeatureCard = ({ icon, title, description, variant = "light" }: FeatureCardProps) => {
	const isDark = variant === "dark";

	return (
		<motion.div
			whileHover={{ y: -6, scale: 1.02 }}
			transition={{ type: "spring", stiffness: 300, damping: 20 }}
			className={`group relative flex flex-col items-center text-center space-y-4 rounded-2xl p-8 transition-shadow duration-300 h-full ${
				isDark
					? "bg-white/5 border border-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-white/5"
					: "bg-white border border-gray-200 hover:border-gray-300 hover:shadow-xl hover:shadow-black/5"
			}`}
		>
			<div
				className={`rounded-xl p-4 transition-colors duration-300 ${
					isDark
						? "bg-white/10 group-hover:bg-primary/20"
						: "bg-primary/10 group-hover:bg-primary/15"
				}`}
			>
				{icon}
			</div>
			<h3 className={`text-xl font-semibold ${isDark ? "text-white" : "text-black"}`}>{title}</h3>
			<p className={isDark ? "text-white/70" : "text-gray-600"}>{description}</p>
		</motion.div>
	);
};

interface NumberStepCardProps {
	step: number;
	title: string;
	description: string;
}

export const NumberStepCard = ({ step, title, description }: NumberStepCardProps) => {
	return (
		<motion.div
			whileHover={{ y: -4 }}
			transition={{ type: "spring", stiffness: 300, damping: 20 }}
			className="relative flex flex-col items-start rounded-2xl bg-white border border-gray-200 p-8 hover:shadow-xl hover:shadow-black/5 transition-shadow duration-300 h-full"
		>
			<div className="text-5xl font-black text-primary/20 mb-3">{step}</div>
			<h3 className="text-xl font-semibold mb-2">{title}</h3>
			<p className="text-gray-600">{description}</p>
		</motion.div>
	);
};
