import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class AppTopBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final IconData? icon;
  final List<Widget> actions;
  final PreferredSizeWidget? bottom;

  AppTopBar({
    super.key,
    required this.title,
    this.actions = const [],
    this.bottom,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
        color: Theme.of(context).brightness == Brightness.light
            ? AppBgColorLight.base
            : AppBgColorDark.overlay,
        shape: Border(
          bottom: BorderSide(
            color: Theme.of(context).brightness == Brightness.light
                ? AppBorderColorLight.darker
                : AppBorderColorDark.light,
            width: AppSpacings.scale(1),
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  icon != null
                      ? Padding(
                          padding: EdgeInsets.only(left: AppSpacings.pMd),
                          child: IconTheme(
                            data: IconThemeData(
                              size: AppSpacings.scale(16),
                              color: Theme.of(context).brightness ==
                                      Brightness.light
                                  ? AppTextColorLight.regular
                                  : AppTextColorDark.regular,
                            ),
                            child: Icon(icon),
                          ),
                        )
                      : Navigator.canPop(context)
                          ? GestureDetector(
                              onTap: () => Navigator.maybePop(context),
                              child: Padding(
                                padding: EdgeInsets.only(left: AppSpacings.pMd),
                                child: IconTheme(
                                  data: IconThemeData(
                                    size: AppSpacings.scale(16),
                                    color: Theme.of(context).brightness ==
                                            Brightness.light
                                        ? AppTextColorLight.regular
                                        : AppTextColorDark.regular,
                                  ),
                                  child: Icon(MdiIcons.arrowLeft),
                                ),
                              ),
                            )
                          : null,
                  Expanded(
                    child: Padding(
                      padding:
                          EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
                      child: Text(
                        title,
                        style: TextStyle(
                          color:
                              Theme.of(context).brightness == Brightness.light
                                  ? AppTextColorLight.regular
                                  : AppTextColorDark.regular,
                          fontSize: AppFontSize.base,
                        ),
                      ),
                    ),
                  ),
                  actions.isNotEmpty
                      ? Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: AppSpacings.pMd,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: actions,
                          ),
                        )
                      : null
                ].whereType<Widget>().toList(),
              ),
            ),
            bottom,
          ].whereType<Widget>().toList(),
        ));
  }

  @override
  Size get preferredSize => Size.fromHeight(
        AppSpacings.scale(40.0) +
            (bottom != null ? kTextTabBarHeight : 0),
      );
}
