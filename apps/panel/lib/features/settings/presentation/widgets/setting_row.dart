import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class SettingRow extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final IconData icon;
  final Widget title;
  final Widget subtitle;
  final Widget? trailing;

  SettingRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.trailing,
    super.key,
  });

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
        icon,
        size: AppFontSize.large,
      ),
      title: title,
      subtitle: subtitle,
      trailing: trailing,
    );
  }
}
