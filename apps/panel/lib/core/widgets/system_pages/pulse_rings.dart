import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:flutter/material.dart';

/// Animated pulse rings that expand outward from center
/// Used for discovery/searching states
class PulseRings extends StatefulWidget {
  final double size;
  final Color color;
  final int ringCount;

  const PulseRings({
    super.key,
    this.size = 80,
    required this.color,
    this.ringCount = 2,
  });

  @override
  State<PulseRings> createState() => _PulseRingsState();
}

class _PulseRingsState extends State<PulseRings> with TickerProviderStateMixin {
  final ScreenService _screenService = locator<ScreenService>();

  late List<AnimationController> _controllers;
  late List<Animation<double>> _scaleAnimations;
  late List<Animation<double>> _opacityAnimations;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(
      widget.ringCount,
      (i) => AnimationController(
        duration: const Duration(milliseconds: 1500),
        vsync: this,
      ),
    );

    _scaleAnimations = _controllers.map((c) {
      return Tween<double>(begin: 1.0, end: 1.6).animate(
        CurvedAnimation(parent: c, curve: Curves.easeOut),
      );
    }).toList();

    _opacityAnimations = _controllers.map((c) {
      return Tween<double>(begin: 0.8, end: 0.0).animate(
        CurvedAnimation(parent: c, curve: Curves.easeOut),
      );
    }).toList();

    // Start animations with staggered delay
    for (int i = 0; i < widget.ringCount; i++) {
      Future.delayed(Duration(milliseconds: i * 500), () {
        if (mounted) {
          _controllers[i].repeat();
        }
      });
    }
  }

  @override
  void dispose() {
    for (var c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        alignment: Alignment.center,
        children: List.generate(widget.ringCount, (i) {
          return AnimatedBuilder(
            animation: _controllers[i],
            builder: (context, child) {
              return Transform.scale(
                scale: _scaleAnimations[i].value,
                child: Opacity(
                  opacity: _opacityAnimations[i].value,
                  child: Container(
                    width: widget.size,
                    height: widget.size,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: widget.color, width: _screenService.scale(2)),
                    ),
                  ),
                ),
              );
            },
          );
        }),
      ),
    );
  }
}
