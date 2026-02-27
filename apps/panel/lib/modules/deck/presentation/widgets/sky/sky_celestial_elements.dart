import 'dart:math' as math;

import 'package:fastybird_smart_panel/modules/deck/types/sky_condition.dart';
import 'package:flutter/material.dart';

/// Renders sun, moon, and/or twinkling stars based on [SkyVisualConfig].
///
/// Sun position tracks across an arc: 0.0 = right (sunrise), 0.5 = top (noon),
/// 1.0 = left (sunset). Stars use [SkyVisualConfig.starOpacity] for fading.
class SkyCelestialElements extends StatelessWidget {
	final SkyVisualConfig config;
	final bool isPortrait;

	const SkyCelestialElements({
		super.key,
		required this.config,
		required this.isPortrait,
	});

	@override
	Widget build(BuildContext context) {
		return LayoutBuilder(
			builder: (context, constraints) {
				return Stack(
					children: [
						if (config.showSun) _buildSun(constraints),
						if (config.showMoon)
							Positioned(
								top: isPortrait ? 12 : 24,
								right: isPortrait ? 32 : 48,
								child: const _MoonWidget(size: 34),
							),
						if (config.showStars) ..._buildStars(),
					],
				);
			},
		);
	}

	Widget _buildSun(BoxConstraints constraints) {
		// Sun travels along a semicircular arc from right to left.
		// sunPosition: 0.0 = right (sunrise), 0.5 = top (noon), 1.0 = left (sunset)
		final w = constraints.maxWidth;
		final h = constraints.maxHeight;
		final margin = isPortrait ? 32.0 : 48.0;

		// Horizontal: map sunPosition 0→1 to (w - margin) → margin
		final cx = w - margin - (w - 2 * margin) * config.sunPosition;
		// Vertical: arc peaking at top — sin(π * sunPosition) gives 0→1→0
		final arcHeight = (isPortrait ? h * 0.7 : h * 0.6);
		final baseY = isPortrait ? h * 0.3 : h * 0.35;
		final cy = baseY - math.sin(math.pi * config.sunPosition) * arcHeight + margin;

		return Positioned(
			left: cx - 20,
			top: cy - 20,
			child: _SunWidget(size: 40, opacity: config.sunOpacity),
		);
	}

	List<Widget> _buildStars() {
		final rng = math.Random(42);

		return List.generate(
			14,
			(i) => Positioned(
				top: rng.nextDouble() * (isPortrait ? 180 : 400),
				left: rng.nextDouble() * (isPortrait ? 360 : 340),
				child: _StarWidget(
					delay: Duration(milliseconds: (i * 300) % 3000),
					maxOpacity: config.starOpacity,
				),
			),
		);
	}
}

class _SunWidget extends StatelessWidget {
	final double size;
	final double opacity;

	const _SunWidget({required this.size, this.opacity = 1.0});

	@override
	Widget build(BuildContext context) {
		return Opacity(
			opacity: opacity,
			child: Container(
				width: size,
				height: size,
				decoration: BoxDecoration(
					shape: BoxShape.circle,
					gradient: const RadialGradient(
						colors: [Color(0xFFFFE066), Color(0xFFFFD93D), Color(0x4DFFD93D)],
						stops: [0.3, 0.7, 1.0],
					),
					boxShadow: [
						BoxShadow(
							color: const Color(0xFFFFD93D).withValues(alpha: 0.5),
							blurRadius: 30,
							spreadRadius: 5,
						),
						BoxShadow(
							color: const Color(0xFFFFD93D).withValues(alpha: 0.2),
							blurRadius: 60,
							spreadRadius: 10,
						),
					],
				),
			),
		);
	}
}

class _MoonWidget extends StatelessWidget {
	final double size;

	const _MoonWidget({required this.size});

	@override
	Widget build(BuildContext context) {
		return Container(
			width: size,
			height: size,
			decoration: BoxDecoration(
				shape: BoxShape.circle,
				gradient: const RadialGradient(
					center: Alignment(-0.3, -0.2),
					colors: [Color(0xFFE8E4D8), Color(0xFFD8D4C8), Color(0xFFC8C4B8)],
				),
				boxShadow: [
					BoxShadow(
						color: const Color(0xFFC8C8B4).withValues(alpha: 0.25),
						blurRadius: 20,
						spreadRadius: 2,
					),
				],
			),
		);
	}
}

class _StarWidget extends StatefulWidget {
	final Duration delay;
	final double maxOpacity;

	const _StarWidget({required this.delay, this.maxOpacity = 1.0});

	@override
	State<_StarWidget> createState() => _StarWidgetState();
}

class _StarWidgetState extends State<_StarWidget> with SingleTickerProviderStateMixin {
	late final AnimationController _ctrl;

	@override
	void initState() {
		super.initState();
		_ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 3));
		Future.delayed(widget.delay, () {
			if (mounted) _ctrl.repeat(reverse: true);
		});
	}

	@override
	void dispose() {
		_ctrl.dispose();
		super.dispose();
	}

	@override
	Widget build(BuildContext context) {
		return AnimatedBuilder(
			animation: _ctrl,
			builder: (_, __) => Opacity(
				opacity: (0.3 + (_ctrl.value * 0.7)) * widget.maxOpacity,
				child: Container(
					width: 2,
					height: 2,
					decoration: const BoxDecoration(
						shape: BoxShape.circle,
						color: Colors.white,
					),
				),
			),
		);
	}
}
