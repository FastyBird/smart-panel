import 'package:fastybird_smart_panel/modules/dashboard/models/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tile.dart';
import 'package:flutter/material.dart';

abstract class TileWidget<T extends TileModel, D extends List<DataSourceModel>>
    extends StatelessWidget {
  final T _tile;
  final D _dataSource;

  const TileWidget(T tile, D dataSource, {super.key})
      : _tile = tile,
        _dataSource = dataSource;

  T get tile => _tile;

  D get dataSource => _dataSource;
}
