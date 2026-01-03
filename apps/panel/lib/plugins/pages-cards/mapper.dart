import 'package:fastybird_smart_panel/plugins/pages-cards/presentation/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/plugins/pages-cards/views/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:flutter/material.dart';

Map<PageType, Widget Function(DashboardPageView)> cardsPageWidgetMappers = {
  PageType.cards: (page) {
    return CardsPage(page: page as CardsPageView);
  },
};
