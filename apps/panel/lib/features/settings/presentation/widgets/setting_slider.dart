import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class SettingSlider extends StatelessWidget {
  final IconData leftIcon;
  final IconData rightIcon;
  final double value;
  final bool enabled;
  final Function(double) onChanged;

  const SettingSlider({
    required this.leftIcon,
    required this.rightIcon,
    required this.value,
    required this.enabled,
    required this.onChanged,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Icon(
          leftIcon,
          size: AppFontSize.large,
        ),
        Expanded(
          child: Slider(
            value: value,
            min: 0,
            max: 100,
            divisions: 10,
            label: '${value.toInt()}%',
            onChanged: enabled ? onChanged : null,
          ),
        ),
        Icon(
          rightIcon,
          size: AppFontSize.large,
        ),
      ],
    );
  }
}
