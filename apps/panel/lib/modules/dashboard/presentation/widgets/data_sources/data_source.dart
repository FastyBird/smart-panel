import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:flutter/material.dart';

abstract class DataSourceWidget<D extends DataSourceView>
    extends StatelessWidget {
  final D _dataSource;

  const DataSourceWidget(D dataSource, {super.key}) : _dataSource = dataSource;

  D get dataSource => _dataSource;
}
