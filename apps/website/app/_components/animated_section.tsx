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

interface FadeInProps {
	children: ReactNode;
	className?: string;
	delay?: number;
	y?: number;
}

export const FadeIn = ({ children, className, delay = 0, y = 30 }: FadeInProps) => {
	return (
		<motion.div
			initial={{ opacity: 0, y }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.8, delay }}
			className={className}
		>
			{children}
		</motion.div>
	);
};

interface SlideInViewProps {
	children: ReactNode;
	className?: string;
	x?: number;
}

export const SlideInView = ({ children, className, x = 60 }: SlideInViewProps) => {
	return (
		<motion.div
			initial={{ opacity: 0, x }}
			whileInView={{ opacity: 1, x: 0 }}
			viewport={{ once: true }}
			transition={{ duration: 0.8 }}
			className={className}
		>
			{children}
		</motion.div>
	);
};

interface HoverScaleProps {
	children: ReactNode;
	className?: string;
	scale?: number;
}

export const HoverScale = ({ children, className, scale = 1.1 }: HoverScaleProps) => {
	return (
		<motion.div whileHover={{ scale }} className={className}>
			{children}
		</motion.div>
	);
};

interface HoverLiftProps {
	children: ReactNode;
	className?: string;
	y?: number;
}

export const HoverLift = ({ children, className, y = -6 }: HoverLiftProps) => {
	return (
		<motion.div
			whileHover={{ y }}
			transition={{ type: "spring", stiffness: 300, damping: 20 }}
			className={className}
		>
			{children}
		</motion.div>
	);
};

interface ScrollIndicatorProps {
	children: ReactNode;
	className?: string;
}

export const ScrollIndicator = ({ children, className }: ScrollIndicatorProps) => {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ delay: 1.5 }}
			className={className}
		>
			<motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
				{children}
			</motion.div>
		</motion.div>
	);
};
