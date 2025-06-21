import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class SettingRow extends StatelessWidget {
  final IconData _icon;
  final Widget _title;
  final Widget _subtitle;
  final Widget? _trailing;

  const SettingRow({
    required IconData icon,
    required Widget title,
    required Widget subtitle,
    Widget? trailing,
    super.key,
  })  : _icon = icon,
        _title = title,
        _subtitle = subtitle,
        _trailing = trailing;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(
        _icon,
        size: AppFontSize.large,
      ),
      title: Column(
        mainAxisAlignment: MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          _title,
          _subtitle,
        ],
      ),
      trailing: _trailing,
    );
  }
}
