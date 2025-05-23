import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';

abstract class TileWidget<T extends TileView> extends StatelessWidget {
  final T _tile;

  const TileWidget(T tile, {super.key}) : _tile = tile;

  T get tile => _tile;
}
