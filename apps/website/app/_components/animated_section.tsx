"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";

interface AnimatedSectionProps {
	children: ReactNode;
	className?: string;
	delay?: number;
}

export const AnimatedSection = ({ children, className, delay = 0 }: AnimatedSectionProps) => {
	return (
		<motion.div
			initial={{ opacity: 0, y: 40 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-80px" }}
			transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
			className={className}
		>
			{children}
		</motion.div>
	);
};

interface StaggerContainerProps {
	children: ReactNode;
	className?: string;
	staggerDelay?: number;
}

export const StaggerContainer = ({ children, className, staggerDelay = 0.1 }: StaggerContainerProps) => {
	return (
		<motion.div
			initial="hidden"
			whileInView="visible"
			viewport={{ once: true, margin: "-60px" }}
			variants={{
				hidden: {},
				visible: {
					transition: {
						staggerChildren: staggerDelay,
					},
				},
			}}
			className={className}
		>
			{children}
		</motion.div>
	);
};

interface StaggerItemProps {
	children: ReactNode;
	className?: string;
}

export const StaggerItem = ({ children, className }: StaggerItemProps) => {
	return (
		<motion.div
			variants={{
				hidden: { opacity: 0, y: 30 },
				visible: {
					opacity: 1,
					y: 0,
					transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
				},
			}}
			className={className}
		>
			{children}
		</motion.div>
	);
};
