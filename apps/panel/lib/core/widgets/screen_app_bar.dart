import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class ScreenAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final IconData? icon;
  final List<Widget> actions;
  final PreferredSizeWidget? bottom;

  const ScreenAppBar({
    super.key,
    required this.title,
    this.actions = const [],
    this.bottom,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return AppBar(
      leadingWidth: AppFontSize.large + AppSpacings.pMd,
      leading: icon != null
          ? Padding(
              padding: EdgeInsets.only(left: AppSpacings.pMd),
              child: Icon(icon),
            )
          : null,
      title: Padding(
        padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
        child: Text(title),
      ),
      actions: actions,
      bottom: bottom,
    );
  }

  @override
  Size get preferredSize => Size.fromHeight(
      AppTopBar.size + (bottom != null ? kTextTabBarHeight : 0));
}
