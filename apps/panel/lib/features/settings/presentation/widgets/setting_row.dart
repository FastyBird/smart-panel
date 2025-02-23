import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class SettingRow extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final IconData _icon;
  final Widget _title;
  final Widget _subtitle;
  final Widget? _trailing;

  SettingRow({
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
      contentPadding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
      ),
      dense: true,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        side: BorderSide(
          color: Theme.of(context).brightness == Brightness.light
              ? AppBorderColorLight.base
              : AppBorderColorDark.base,
          width: _screenService.scale(1),
        ),
      ),
      textColor: Theme.of(context).brightness == Brightness.light
          ? AppTextColorLight.regular
          : AppTextColorDark.regular,
      leading: Icon(
        _icon,
        size: AppFontSize.large,
      ),
      title: _title,
      subtitle: _subtitle,
      trailing: _trailing,
    );
  }
}
