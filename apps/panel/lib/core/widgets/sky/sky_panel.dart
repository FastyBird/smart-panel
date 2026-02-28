import 'dart:math' as math;

import 'package:fastybird_smart_panel/core/widgets/sky/sky_condition.dart';
import 'package:fastybird_smart_panel/core/widgets/sky/sky_effects.dart';
import 'package:fastybird_smart_panel/core/widgets/sky/sky_elements.dart';
import 'package:flutter/material.dart';

/// Animated sky panel that displays weather-appropriate gradient background
/// with celestial bodies, clouds, and weather particle effects.
///
/// Used as a shared visual component between the deck home screen
/// and the weather detail screen.
class SkyPanel extends StatelessWidget {
	final SkyCondition condition;
	final bool isNight;
	final Widget? child;
	final BorderRadius? borderRadius;

	const SkyPanel({
		super.key,
		required this.condition,
		required this.isNight,
		this.child,
		this.borderRadius,
	});

	@override
	Widget build(BuildContext context) {
		final config = SkyConfig.fromCondition(condition, isNight);
		final gradient = SkyGradients.get(condition, isNight);

		Widget panel = AnimatedContainer(
			duration: const Duration(milliseconds: 800),
			curve: Curves.easeInOut,
			decoration: BoxDecoration(
				gradient: LinearGradient(
					begin: Alignment.topCenter,
					end: Alignment.bottomCenter,
					colors: gradient,
				),
				borderRadius: borderRadius,
			),
			child: LayoutBuilder(
				builder: (context, constraints) {
					final w = constraints.maxWidth;
					final h = constraints.maxHeight;

					return Stack(
						children: [
							// Celestial bodies
							if (config.showSun)
								Positioned(
									top: 16,
									right: 32,
									child: SkyWidgetSun(size: 40, opacity: config.sunOpacity),
								),
							if (config.showMoon)
								Positioned(
									top: 12,
									right: 32,
									child: SkyWidgetMoon(size: 34),
								),

							// Stars
							if (config.showStars) ..._buildStars(w, h),

							// Clouds
							if (config.cloudCount > 0) ..._buildClouds(config, w, h),

							// Weather effects
							if (config.showRain)
								Positioned.fill(
									child: SkyEffectRain(intensity: config.rainIntensity, isNight: isNight),
								),
							if (config.showSnow)
								Positioned.fill(
									child: SkyEffectSnow(intensity: config.snowIntensity, isNight: isNight),
								),
							if (config.showWind)
								Positioned.fill(
									child: SkyEffectWind(isNight: isNight),
								),
							if (config.showLightning) const Positioned.fill(child: SkyEffectLightning()),
							if (config.showFog)
								Positioned.fill(
									child: SkyEffectFog(isNight: isNight),
								),

							// Content overlay
							if (child != null) Positioned.fill(child: child!),
						],
					);
				},
			),
		);

		if (borderRadius != null) {
			panel = ClipRRect(borderRadius: borderRadius!, child: panel);
		}

		return panel;
	}

	List<Widget> _buildStars(double panelWidth, double panelHeight) {
		final rng = math.Random(42);

		return List.generate(
			14,
			(i) => Positioned(
				top: rng.nextDouble() * (panelHeight * 0.6),
				left: rng.nextDouble() * panelWidth,
				child: SkyWidgetStar(delay: Duration(milliseconds: (i * 300) % 3000)),
			),
		);
	}

	List<Widget> _buildClouds(SkyConfig config, double panelWidth, double panelHeight) {
		final rng = math.Random(7);

		return List.generate(config.cloudCount, (i) {
			final w = 40.0 + rng.nextDouble() * 50;

			return Positioned(
				top: 8 + rng.nextDouble() * (panelHeight * 0.6),
				left: rng.nextDouble() * (panelWidth - w),
				child: SkyWidgetCloud(
					width: w,
					opacity: config.cloudOpacity * (0.7 + rng.nextDouble() * 0.3),
					isDark: isNight,
				),
			);
		});
	}
}
