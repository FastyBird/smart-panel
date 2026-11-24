import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:flutter/material.dart';

/// The one switch (docs/display-ui-design-spec.md §5): a 40 × 22 pill with an
/// 18 px white thumb, in a 52 × 36 tap zone. On, the track is the accent
/// outside a domain view and the domain colour inside one; off, it is grey.
///
/// - [ControlState.pending]: the thumb gets a dashed `text.secondary` ring.
/// - [ControlState.unconfirmed]: the ring is dashed in the warning colour.
/// - [ControlState.disabled] (or no [onChanged]): the track is
///   `text.disabled` when on and `fill.base` when off, and it does not move.
///
/// It takes focus and toggles on Enter and Space.
class AppSwitch extends StatelessWidget {
  const AppSwitch({
    super.key,
    required this.value,
    this.onChanged,
    this.color,
    this.state = ControlState.idle,
    this.semanticLabel,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;

  /// The domain colour; null or [ThemeColors.primary] is the accent.
  final ThemeColors? color;

  final ControlState state;

  /// What the switch turns on, for screen readers ("Screen saver").
  final String? semanticLabel;

  /// Tap zone, in design px.
  static const double zoneWidth = 52;
  static const double zoneHeight = 36;

  /// Track and thumb, in design px.
  static const double trackWidth = 40;
  static const double trackHeight = 22;
  static const double thumbSize = 18;

  bool get _enabled => onChanged != null && state != ControlState.disabled;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final enabled = _enabled;
    final dash = controlDashColor(
      theme,
      enabled || state != ControlState.idle ? state : ControlState.disabled,
    );

    final track = !enabled
        ? (value ? neutrals.textDisabled : neutrals.fillBase)
        : value
        ? ControlTint.of(theme, color).fill
        : AppControlColors.switchOff(theme.brightness);
    final thumb = enabled ? AppControlColors.thumb : neutrals.surfaceCard;
    final thumbSide = AppSpacings.scale(thumbSize);
    final toggle = enabled ? () => onChanged!(!value) : null;

    return Semantics(
      toggled: value,
      enabled: enabled,
      label: semanticLabel,
      onTap: toggle,
      child: SizedBox(
        width: AppSpacings.scale(zoneWidth),
        height: AppSpacings.scale(zoneHeight),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: toggle,
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
            excludeFromSemantics: true,
            child: Center(
              child: AnimatedContainer(
                duration: AppAnimation.standard,
                width: AppSpacings.scale(trackWidth),
                height: AppSpacings.scale(trackHeight),
                padding: EdgeInsets.all(AppSpacings.scale(2)),
                decoration: BoxDecoration(
                  color: track,
                  borderRadius: BorderRadius.circular(AppBorderRadius.pill),
                ),
                child: AnimatedAlign(
                  duration: AppAnimation.standard,
                  alignment: value
                      ? Alignment.centerRight
                      : Alignment.centerLeft,
                  child: CustomPaint(
                    size: Size.square(thumbSide),
                    painter: _ThumbPainter(fill: thumb, dash: dash),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ThumbPainter extends CustomPainter {
  const _ThumbPainter({required this.fill, required this.dash});

  final Color fill;
  final Color? dash;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide / 2;
    canvas.drawCircle(center, radius, Paint()..color = fill);

    if (dash != null) {
      final width = AppSpacings.scale(2);
      paintDashedCircle(
        canvas,
        center,
        radius - width / 2,
        Paint()
          ..color = dash!
          ..style = PaintingStyle.stroke
          ..strokeWidth = width,
        dashes: 8,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _ThumbPainter old) =>
      old.fill != fill || old.dash != dash;
}
