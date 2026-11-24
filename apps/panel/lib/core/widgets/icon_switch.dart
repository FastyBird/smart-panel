import 'package:fastybird_smart_panel/core/widgets/app_switch.dart';
import 'package:flutter/material.dart';

/// A switch that flips at once and reports the new state.
///
/// Draws the one [AppSwitch]. [iconOn], [iconOff] and [toggleMode] are kept
/// so callers compile; the switch no longer shows icons or a neutral mode.
class IconSwitch extends StatefulWidget {
  final bool switchState;
  final IconData iconOn;
  final IconData iconOff;
  final bool toggleMode;
  final ValueChanged<bool> onChanged;

  const IconSwitch({
    super.key,
    required this.switchState,
    required this.iconOn,
    required this.iconOff,
    this.toggleMode = false,
    required this.onChanged,
  });

  @override
  State<IconSwitch> createState() => _IconSwitchState();
}

class _IconSwitchState extends State<IconSwitch> {
  late bool _switchState = widget.switchState;

  @override
  void didUpdateWidget(covariant IconSwitch oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.switchState != widget.switchState) {
      setState(() => _switchState = widget.switchState);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppSwitch(
      value: _switchState,
      onChanged: (value) {
        setState(() => _switchState = value);
        widget.onChanged(value);
      },
    );
  }
}
