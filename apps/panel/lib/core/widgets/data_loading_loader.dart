import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class DataLoadingLoader extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final String _heading;

  final String _subHeading;

  DataLoadingLoader({
    super.key,
    required String heading,
    required String subHeading,
  })  : _heading = heading,
        _subHeading = subHeading;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: AppSpacings.paddingMd,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(
              width: _screenService.scale(50),
              height: _screenService.scale(50),
              child: const CircularProgressIndicator(),
            ),
            AppSpacings.spacingMdVertical,
            Text(
              _heading,
              textAlign: TextAlign.center,
            ),
            AppSpacings.spacingSmVertical,
            Text(
              _subHeading,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
