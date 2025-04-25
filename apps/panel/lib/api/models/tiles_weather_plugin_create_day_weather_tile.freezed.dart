// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'tiles_weather_plugin_create_day_weather_tile.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

TilesWeatherPluginCreateDayWeatherTile
    _$TilesWeatherPluginCreateDayWeatherTileFromJson(
        Map<String, dynamic> json) {
  return _TilesWeatherPluginCreateDayWeatherTile.fromJson(json);
}

/// @nodoc
mixin _$TilesWeatherPluginCreateDayWeatherTile {
  /// Unique identifier for the dashboard tile (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the tile type
  String get type => throw _privateConstructorUsedError;

  /// The row position of the tile in the grid.
  int get row => throw _privateConstructorUsedError;

  /// The column position of the tile in the grid.
  int get col => throw _privateConstructorUsedError;

  /// A list of data sources used by the tile, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardModuleCreateDataSource> get dataSource =>
      throw _privateConstructorUsedError;

  /// The number of rows the tile spans in the grid.
  @JsonKey(name: 'row_span')
  int get rowSpan => throw _privateConstructorUsedError;

  /// The number of columns the tile spans in the grid.
  @JsonKey(name: 'col_span')
  int get colSpan => throw _privateConstructorUsedError;

  /// Mark the tile as hidden and will not be displayed on the display application.
  bool get hidden => throw _privateConstructorUsedError;

  /// Serializes this TilesWeatherPluginCreateDayWeatherTile to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of TilesWeatherPluginCreateDayWeatherTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $TilesWeatherPluginCreateDayWeatherTileCopyWith<
          TilesWeatherPluginCreateDayWeatherTile>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $TilesWeatherPluginCreateDayWeatherTileCopyWith<$Res> {
  factory $TilesWeatherPluginCreateDayWeatherTileCopyWith(
          TilesWeatherPluginCreateDayWeatherTile value,
          $Res Function(TilesWeatherPluginCreateDayWeatherTile) then) =
      _$TilesWeatherPluginCreateDayWeatherTileCopyWithImpl<$Res,
          TilesWeatherPluginCreateDayWeatherTile>;
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardModuleCreateDataSource> dataSource,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      bool hidden});
}

/// @nodoc
class _$TilesWeatherPluginCreateDayWeatherTileCopyWithImpl<$Res,
        $Val extends TilesWeatherPluginCreateDayWeatherTile>
    implements $TilesWeatherPluginCreateDayWeatherTileCopyWith<$Res> {
  _$TilesWeatherPluginCreateDayWeatherTileCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of TilesWeatherPluginCreateDayWeatherTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? hidden = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardModuleCreateDataSource>,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      hidden: null == hidden
          ? _value.hidden
          : hidden // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$TilesWeatherPluginCreateDayWeatherTileImplCopyWith<$Res>
    implements $TilesWeatherPluginCreateDayWeatherTileCopyWith<$Res> {
  factory _$$TilesWeatherPluginCreateDayWeatherTileImplCopyWith(
          _$TilesWeatherPluginCreateDayWeatherTileImpl value,
          $Res Function(_$TilesWeatherPluginCreateDayWeatherTileImpl) then) =
      __$$TilesWeatherPluginCreateDayWeatherTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardModuleCreateDataSource> dataSource,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      bool hidden});
}

/// @nodoc
class __$$TilesWeatherPluginCreateDayWeatherTileImplCopyWithImpl<$Res>
    extends _$TilesWeatherPluginCreateDayWeatherTileCopyWithImpl<$Res,
        _$TilesWeatherPluginCreateDayWeatherTileImpl>
    implements _$$TilesWeatherPluginCreateDayWeatherTileImplCopyWith<$Res> {
  __$$TilesWeatherPluginCreateDayWeatherTileImplCopyWithImpl(
      _$TilesWeatherPluginCreateDayWeatherTileImpl _value,
      $Res Function(_$TilesWeatherPluginCreateDayWeatherTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of TilesWeatherPluginCreateDayWeatherTile
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? hidden = null,
  }) {
    return _then(_$TilesWeatherPluginCreateDayWeatherTileImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardModuleCreateDataSource>,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      hidden: null == hidden
          ? _value.hidden
          : hidden // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$TilesWeatherPluginCreateDayWeatherTileImpl
    implements _TilesWeatherPluginCreateDayWeatherTile {
  const _$TilesWeatherPluginCreateDayWeatherTileImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardModuleCreateDataSource> dataSource,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0,
      this.hidden = false})
      : _dataSource = dataSource;

  factory _$TilesWeatherPluginCreateDayWeatherTileImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$TilesWeatherPluginCreateDayWeatherTileImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardModuleCreateDataSource> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardModuleCreateDataSource> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  /// Mark the tile as hidden and will not be displayed on the display application.
  @override
  @JsonKey()
  final bool hidden;

  @override
  String toString() {
    return 'TilesWeatherPluginCreateDayWeatherTile(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, rowSpan: $rowSpan, colSpan: $colSpan, hidden: $hidden)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$TilesWeatherPluginCreateDayWeatherTileImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            (identical(other.hidden, hidden) || other.hidden == hidden));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      row,
      col,
      const DeepCollectionEquality().hash(_dataSource),
      rowSpan,
      colSpan,
      hidden);

  /// Create a copy of TilesWeatherPluginCreateDayWeatherTile
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$TilesWeatherPluginCreateDayWeatherTileImplCopyWith<
          _$TilesWeatherPluginCreateDayWeatherTileImpl>
      get copyWith =>
          __$$TilesWeatherPluginCreateDayWeatherTileImplCopyWithImpl<
              _$TilesWeatherPluginCreateDayWeatherTileImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$TilesWeatherPluginCreateDayWeatherTileImplToJson(
      this,
    );
  }
}

abstract class _TilesWeatherPluginCreateDayWeatherTile
    implements TilesWeatherPluginCreateDayWeatherTile {
  const factory _TilesWeatherPluginCreateDayWeatherTile(
      {required final String id,
      required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardModuleCreateDataSource> dataSource,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span') final int colSpan,
      final bool hidden}) = _$TilesWeatherPluginCreateDayWeatherTileImpl;

  factory _TilesWeatherPluginCreateDayWeatherTile.fromJson(
          Map<String, dynamic> json) =
      _$TilesWeatherPluginCreateDayWeatherTileImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardModuleCreateDataSource> get dataSource;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Mark the tile as hidden and will not be displayed on the display application.
  @override
  bool get hidden;

  /// Create a copy of TilesWeatherPluginCreateDayWeatherTile
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$TilesWeatherPluginCreateDayWeatherTileImplCopyWith<
          _$TilesWeatherPluginCreateDayWeatherTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}
