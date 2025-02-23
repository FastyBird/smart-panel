import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/cards_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/cards.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:provider/provider.dart';

class CardsPage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final CardsPageModel page;

  CardsPage({super.key, required this.page});

  @override
  Widget build(BuildContext context) {
    return Consumer<CardsRepository>(builder: (
      context,
      cardsRepository,
      _,
    ) {
      final cards = cardsRepository.getItems(page.cards);

      if (cards.isEmpty) {
        final localizations = AppLocalizations.of(context)!;

        return Scaffold(
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Symbols.dashboard,
                    color: Theme.of(context).warning,
                    size: _screenService.scale(64),
                  ),
                  AppSpacings.spacingMdVertical,
                  Text(
                    localizations.message_error_home_not_configured_title,
                    textAlign: TextAlign.center,
                  ),
                  AppSpacings.spacingSmVertical,
                  Text(
                    localizations.message_error_home_not_configured_description,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      }

      return Scaffold(
        body: SafeArea(
          child: Padding(
            padding: AppSpacings.paddingMd,
            child: Column(
              children: [Text('text')],
            ),
          ),
        ),
      );
    });
  }
}
