import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/cupertino.dart';

abstract class DashboardPageView<M extends PageModel> {
  final M _pageModel;

  DashboardPageView({
    required M pageModel,
  }) : _pageModel = pageModel;

  String get id => _pageModel.id;

  M get pageModel => _pageModel;

  PageType get type => _pageModel.type;

  String get title => _pageModel.title;

  IconData? get icon => _pageModel.icon;

  bool get showTopBar => _pageModel.showTopBar;

  int get order => _pageModel.order;
}
