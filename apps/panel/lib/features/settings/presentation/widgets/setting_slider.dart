import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class SettingSlider extends StatelessWidget {
  final IconData _leftIcon;
  final IconData _rightIcon;
  final double _value;
  final bool _enabled;
  final Function(double) _onChanged;

  const SettingSlider({
    required IconData leftIcon,
    required IconData rightIcon,
    required double value,
    required bool enabled,
    required Function(double) onChanged,
    super.key,
  })  : _leftIcon = leftIcon,
        _rightIcon = rightIcon,
        _value = value,
        _enabled = enabled,
        _onChanged = onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Icon(
          _leftIcon,
          size: AppFontSize.large,
        ),
        Expanded(
          child: Slider(
            value: _value,
            min: 0,
            max: 100,
            divisions: 10,
            label: '${_value.toInt()}%',
            onChanged: _enabled ? _onChanged : null,
          ),
        ),
        Icon(
          _rightIcon,
          size: AppFontSize.large,
        ),
      ],
    );
  }
}
