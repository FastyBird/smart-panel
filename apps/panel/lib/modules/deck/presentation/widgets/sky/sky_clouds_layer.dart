import 'dart:math' as math;

import 'package:fastybird_smart_panel/modules/deck/types/sky_condition.dart';
import 'package:flutter/material.dart';

/// Positions cloud widgets based on [SkyVisualConfig.cloudCount] and opacity.
class SkyCloudsLayer extends StatelessWidget {
	final SkyVisualConfig config;
	final bool isPortrait;

	const SkyCloudsLayer({
		super.key,
		required this.config,
		required this.isPortrait,
	});

	@override
	Widget build(BuildContext context) {
		if (config.cloudCount <= 0) return const SizedBox.shrink();

		final rng = math.Random(7);
		final maxW = isPortrait ? 320.0 : 300.0;
		final maxH = isPortrait ? 160.0 : 380.0;

		return Stack(
			children: List.generate(config.cloudCount, (i) {
				final w = 40.0 + rng.nextDouble() * 50;

				return Positioned(
					top: 8 + rng.nextDouble() * (maxH * 0.6),
					left: rng.nextDouble() * (maxW - w),
					child: _CloudWidget(
						width: w,
						opacity: config.cloudOpacity * (0.7 + rng.nextDouble() * 0.3),
						isNight: config.isDark,
					),
				);
			}),
		);
	}
}

class _CloudWidget extends StatelessWidget {
	final double width;
	final double opacity;
	final bool isNight;

	const _CloudWidget({
		required this.width,
		required this.opacity,
		this.isNight = false,
	});

	@override
	Widget build(BuildContext context) {
		final h = width * 0.35;
		final c = isNight
				? Colors.white.withValues(alpha: opacity * 0.5)
				: Colors.white.withValues(alpha: opacity);

		return SizedBox(
			width: width,
			height: h + 12,
			child: Stack(
				children: [
					Positioned(
						bottom: 0,
						left: 0,
						right: 0,
						child: Container(
							height: h,
							decoration: BoxDecoration(
								color: c,
								borderRadius: BorderRadius.circular(h / 2),
							),
						),
					),
					Positioned(
						bottom: h * 0.4,
						left: width * 0.15,
						child: Container(
							width: width * 0.4,
							height: h * 0.8,
							decoration: BoxDecoration(
								color: c,
								borderRadius: BorderRadius.circular(h),
							),
						),
					),
					Positioned(
						bottom: h * 0.3,
						left: width * 0.4,
						child: Container(
							width: width * 0.35,
							height: h * 0.65,
							decoration: BoxDecoration(
								color: c,
								borderRadius: BorderRadius.circular(h),
							),
						),
					),
				],
			),
		);
	}
}
