import 'package:flutter/material.dart';

// =============================================================================
// SUN
// =============================================================================

class SkyWidgetSun extends StatelessWidget {
	final double size;
	final double opacity;

	const SkyWidgetSun({
		super.key,
		required this.size,
		this.opacity = 1.0,
	});

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
						BoxShadow(color: const Color(0xFFFFD93D).withValues(alpha: 0.5), blurRadius: 30, spreadRadius: 5),
						BoxShadow(color: const Color(0xFFFFD93D).withValues(alpha: 0.2), blurRadius: 60, spreadRadius: 10),
					],
				),
			),
		);
	}
}

// =============================================================================
// MOON
// =============================================================================

class SkyWidgetMoon extends StatelessWidget {
	final double size;
	final double opacity;

	const SkyWidgetMoon({
		super.key,
		required this.size,
		this.opacity = 1.0,
	});

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
						center: Alignment(-0.3, -0.2),
						colors: [Color(0xFFE8E4D8), Color(0xFFD8D4C8), Color(0xFFC8C4B8)],
					),
					boxShadow: [
						BoxShadow(color: const Color(0xFFC8C8B4).withValues(alpha: 0.25), blurRadius: 20, spreadRadius: 2),
					],
				),
			),
		);
	}
}

// =============================================================================
// STAR (twinkling)
// =============================================================================

class SkyWidgetStar extends StatefulWidget {
	final Duration delay;

	const SkyWidgetStar({
		super.key,
		required this.delay,
	});

	@override
	State<SkyWidgetStar> createState() => _SkyWidgetStarState();
}

class _SkyWidgetStarState extends State<SkyWidgetStar> with SingleTickerProviderStateMixin {
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
				opacity: 0.3 + (_ctrl.value * 0.7),
				child: Container(
					width: 2,
					height: 2,
					decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
				),
			),
		);
	}
}

// =============================================================================
// CLOUD
// =============================================================================

class SkyWidgetCloud extends StatelessWidget {
	final double width;
	final double opacity;
	final bool isDark;

	const SkyWidgetCloud({
		super.key,
		required this.width,
		required this.opacity,
		this.isDark = false,
	});

	@override
	Widget build(BuildContext context) {
		final h = width * 0.35;
		final c = isDark ? Colors.white.withValues(alpha: opacity * 0.5) : Colors.white.withValues(alpha: opacity);

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
							decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(h / 2)),
						),
					),
					Positioned(
						bottom: h * 0.4,
						left: width * 0.15,
						child: Container(
							width: width * 0.4,
							height: h * 0.8,
							decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(h)),
						),
					),
					Positioned(
						bottom: h * 0.3,
						left: width * 0.4,
						child: Container(
							width: width * 0.35,
							height: h * 0.65,
							decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(h)),
						),
					),
				],
			),
		);
	}
}
