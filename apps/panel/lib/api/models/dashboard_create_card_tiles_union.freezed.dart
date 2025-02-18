// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_card_tiles_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateCardTilesUnion _$DashboardCreateCardTilesUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'device':
      return DashboardCreateDeviceTile.fromJson(json);
    case 'clock':
      return DashboardCreateTimeTile.fromJson(json);
    case 'weather-day':
      return DashboardCreateDayWeatherTile.fromJson(json);
    case 'weather-forecast':
      return DashboardCreateForecastWeatherTile.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'DashboardCreateCardTilesUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardCreateCardTilesUnion {
  /// Unique identifier for the dashboard tile (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// The row position of the tile in the grid.
  int get row => throw _privateConstructorUsedError;

  /// The column position of the tile in the grid.
  int get col => throw _privateConstructorUsedError;

  /// The number of rows the tile spans in the grid.
  @JsonKey(name: 'row_span')
  int get rowSpan => throw _privateConstructorUsedError;

  /// The number of columns the tile spans in the grid.
  @JsonKey(name: 'col_span')
  int get colSpan => throw _privateConstructorUsedError;

  /// A list of data sources used by the tile, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// Specifies the type of tile as a device-specific tile.
  String get type => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardCreateDeviceTile value) device,
    required TResult Function(DashboardCreateTimeTile value) clock,
    required TResult Function(DashboardCreateDayWeatherTile value) weatherDay,
    required TResult Function(DashboardCreateForecastWeatherTile value)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateDeviceTile value)? device,
    TResult? Function(DashboardCreateTimeTile value)? clock,
    TResult? Function(DashboardCreateDayWeatherTile value)? weatherDay,
    TResult? Function(DashboardCreateForecastWeatherTile value)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateDeviceTile value)? device,
    TResult Function(DashboardCreateTimeTile value)? clock,
    TResult Function(DashboardCreateDayWeatherTile value)? weatherDay,
    TResult Function(DashboardCreateForecastWeatherTile value)? weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateCardTilesUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateCardTilesUnionCopyWith<DashboardCreateCardTilesUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateCardTilesUnionCopyWith<$Res> {
  factory $DashboardCreateCardTilesUnionCopyWith(
          DashboardCreateCardTilesUnion value,
          $Res Function(DashboardCreateCardTilesUnion) then) =
      _$DashboardCreateCardTilesUnionCopyWithImpl<$Res,
          DashboardCreateCardTilesUnion>;
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      String type});
}

/// @nodoc
class _$DashboardCreateCardTilesUnionCopyWithImpl<$Res,
        $Val extends DashboardCreateCardTilesUnion>
    implements $DashboardCreateCardTilesUnionCopyWith<$Res> {
  _$DashboardCreateCardTilesUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? dataSource = null,
    Object? type = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCreateDeviceTileImplCopyWith<$Res>
    implements $DashboardCreateCardTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateDeviceTileImplCopyWith(
          _$DashboardCreateDeviceTileImpl value,
          $Res Function(_$DashboardCreateDeviceTileImpl) then) =
      __$$DashboardCreateDeviceTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      String device,
      String? icon,
      String type});
}

/// @nodoc
class __$$DashboardCreateDeviceTileImplCopyWithImpl<$Res>
    extends _$DashboardCreateCardTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateDeviceTileImpl>
    implements _$$DashboardCreateDeviceTileImplCopyWith<$Res> {
  __$$DashboardCreateDeviceTileImplCopyWithImpl(
      _$DashboardCreateDeviceTileImpl _value,
      $Res Function(_$DashboardCreateDeviceTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? dataSource = null,
    Object? device = null,
    Object? icon = freezed,
    Object? type = null,
  }) {
    return _then(_$DashboardCreateDeviceTileImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateDeviceTileImpl implements DashboardCreateDeviceTile {
  const _$DashboardCreateDeviceTileImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      required this.device,
      this.icon,
      this.type = 'device'})
      : _dataSource = dataSource;

  factory _$DashboardCreateDeviceTileImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardCreateDeviceTileImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardCreateTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The icon representing the tile.
  @override
  final String? icon;

  /// Specifies the type of tile as a device-specific tile.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardCreateCardTilesUnion.device(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, device: $device, icon: $icon, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateDeviceTileImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, row, col, rowSpan, colSpan,
      const DeepCollectionEquality().hash(_dataSource), device, icon, type);

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateDeviceTileImplCopyWith<_$DashboardCreateDeviceTileImpl>
      get copyWith => __$$DashboardCreateDeviceTileImplCopyWithImpl<
          _$DashboardCreateDeviceTileImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherForecast,
  }) {
    return device(
        id, row, col, rowSpan, colSpan, dataSource, this.device, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
  }) {
    return device?.call(
        id, row, col, rowSpan, colSpan, dataSource, this.device, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(
          id, row, col, rowSpan, colSpan, dataSource, this.device, icon, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardCreateDeviceTile value) device,
    required TResult Function(DashboardCreateTimeTile value) clock,
    required TResult Function(DashboardCreateDayWeatherTile value) weatherDay,
    required TResult Function(DashboardCreateForecastWeatherTile value)
        weatherForecast,
  }) {
    return device(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateDeviceTile value)? device,
    TResult? Function(DashboardCreateTimeTile value)? clock,
    TResult? Function(DashboardCreateDayWeatherTile value)? weatherDay,
    TResult? Function(DashboardCreateForecastWeatherTile value)?
        weatherForecast,
  }) {
    return device?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateDeviceTile value)? device,
    TResult Function(DashboardCreateTimeTile value)? clock,
    TResult Function(DashboardCreateDayWeatherTile value)? weatherDay,
    TResult Function(DashboardCreateForecastWeatherTile value)? weatherForecast,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateDeviceTileImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateDeviceTile
    implements DashboardCreateCardTilesUnion {
  const factory DashboardCreateDeviceTile(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      required final String device,
      final String? icon,
      final String type}) = _$DashboardCreateDeviceTileImpl;

  factory DashboardCreateDeviceTile.fromJson(Map<String, dynamic> json) =
      _$DashboardCreateDeviceTileImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// The unique identifier of the associated device.
  String get device;

  /// The icon representing the tile.
  String? get icon;

  /// Specifies the type of tile as a device-specific tile.
  @override
  String get type;

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateDeviceTileImplCopyWith<_$DashboardCreateDeviceTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardCreateTimeTileImplCopyWith<$Res>
    implements $DashboardCreateCardTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateTimeTileImplCopyWith(
          _$DashboardCreateTimeTileImpl value,
          $Res Function(_$DashboardCreateTimeTileImpl) then) =
      __$$DashboardCreateTimeTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      String type});
}

/// @nodoc
class __$$DashboardCreateTimeTileImplCopyWithImpl<$Res>
    extends _$DashboardCreateCardTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateTimeTileImpl>
    implements _$$DashboardCreateTimeTileImplCopyWith<$Res> {
  __$$DashboardCreateTimeTileImplCopyWithImpl(
      _$DashboardCreateTimeTileImpl _value,
      $Res Function(_$DashboardCreateTimeTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? dataSource = null,
    Object? type = null,
  }) {
    return _then(_$DashboardCreateTimeTileImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateTimeTileImpl implements DashboardCreateTimeTile {
  const _$DashboardCreateTimeTileImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      this.type = 'clock'})
      : _dataSource = dataSource;

  factory _$DashboardCreateTimeTileImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardCreateTimeTileImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardCreateTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// Specifies the type of tile as a clock.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardCreateCardTilesUnion.clock(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateTimeTileImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, row, col, rowSpan, colSpan,
      const DeepCollectionEquality().hash(_dataSource), type);

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateTimeTileImplCopyWith<_$DashboardCreateTimeTileImpl>
      get copyWith => __$$DashboardCreateTimeTileImplCopyWithImpl<
          _$DashboardCreateTimeTileImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherForecast,
  }) {
    return clock(id, row, col, rowSpan, colSpan, dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
  }) {
    return clock?.call(id, row, col, rowSpan, colSpan, dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(id, row, col, rowSpan, colSpan, dataSource, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardCreateDeviceTile value) device,
    required TResult Function(DashboardCreateTimeTile value) clock,
    required TResult Function(DashboardCreateDayWeatherTile value) weatherDay,
    required TResult Function(DashboardCreateForecastWeatherTile value)
        weatherForecast,
  }) {
    return clock(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateDeviceTile value)? device,
    TResult? Function(DashboardCreateTimeTile value)? clock,
    TResult? Function(DashboardCreateDayWeatherTile value)? weatherDay,
    TResult? Function(DashboardCreateForecastWeatherTile value)?
        weatherForecast,
  }) {
    return clock?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateDeviceTile value)? device,
    TResult Function(DashboardCreateTimeTile value)? clock,
    TResult Function(DashboardCreateDayWeatherTile value)? weatherDay,
    TResult Function(DashboardCreateForecastWeatherTile value)? weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateTimeTileImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateTimeTile
    implements DashboardCreateCardTilesUnion {
  const factory DashboardCreateTimeTile(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      final String type}) = _$DashboardCreateTimeTileImpl;

  factory DashboardCreateTimeTile.fromJson(Map<String, dynamic> json) =
      _$DashboardCreateTimeTileImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// Specifies the type of tile as a clock.
  @override
  String get type;

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateTimeTileImplCopyWith<_$DashboardCreateTimeTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardCreateDayWeatherTileImplCopyWith<$Res>
    implements $DashboardCreateCardTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateDayWeatherTileImplCopyWith(
          _$DashboardCreateDayWeatherTileImpl value,
          $Res Function(_$DashboardCreateDayWeatherTileImpl) then) =
      __$$DashboardCreateDayWeatherTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      String type});
}

/// @nodoc
class __$$DashboardCreateDayWeatherTileImplCopyWithImpl<$Res>
    extends _$DashboardCreateCardTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateDayWeatherTileImpl>
    implements _$$DashboardCreateDayWeatherTileImplCopyWith<$Res> {
  __$$DashboardCreateDayWeatherTileImplCopyWithImpl(
      _$DashboardCreateDayWeatherTileImpl _value,
      $Res Function(_$DashboardCreateDayWeatherTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? dataSource = null,
    Object? type = null,
  }) {
    return _then(_$DashboardCreateDayWeatherTileImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateDayWeatherTileImpl
    implements DashboardCreateDayWeatherTile {
  const _$DashboardCreateDayWeatherTileImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      this.type = 'weather-day'})
      : _dataSource = dataSource;

  factory _$DashboardCreateDayWeatherTileImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateDayWeatherTileImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardCreateTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// Specifies the type of tile as a day weather tile.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardCreateCardTilesUnion.weatherDay(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateDayWeatherTileImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, row, col, rowSpan, colSpan,
      const DeepCollectionEquality().hash(_dataSource), type);

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateDayWeatherTileImplCopyWith<
          _$DashboardCreateDayWeatherTileImpl>
      get copyWith => __$$DashboardCreateDayWeatherTileImplCopyWithImpl<
          _$DashboardCreateDayWeatherTileImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherForecast,
  }) {
    return weatherDay(id, row, col, rowSpan, colSpan, dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
  }) {
    return weatherDay?.call(id, row, col, rowSpan, colSpan, dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(id, row, col, rowSpan, colSpan, dataSource, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardCreateDeviceTile value) device,
    required TResult Function(DashboardCreateTimeTile value) clock,
    required TResult Function(DashboardCreateDayWeatherTile value) weatherDay,
    required TResult Function(DashboardCreateForecastWeatherTile value)
        weatherForecast,
  }) {
    return weatherDay(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateDeviceTile value)? device,
    TResult? Function(DashboardCreateTimeTile value)? clock,
    TResult? Function(DashboardCreateDayWeatherTile value)? weatherDay,
    TResult? Function(DashboardCreateForecastWeatherTile value)?
        weatherForecast,
  }) {
    return weatherDay?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateDeviceTile value)? device,
    TResult Function(DashboardCreateTimeTile value)? clock,
    TResult Function(DashboardCreateDayWeatherTile value)? weatherDay,
    TResult Function(DashboardCreateForecastWeatherTile value)? weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateDayWeatherTileImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateDayWeatherTile
    implements DashboardCreateCardTilesUnion {
  const factory DashboardCreateDayWeatherTile(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      final String type}) = _$DashboardCreateDayWeatherTileImpl;

  factory DashboardCreateDayWeatherTile.fromJson(Map<String, dynamic> json) =
      _$DashboardCreateDayWeatherTileImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// Specifies the type of tile as a day weather tile.
  @override
  String get type;

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateDayWeatherTileImplCopyWith<
          _$DashboardCreateDayWeatherTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardCreateForecastWeatherTileImplCopyWith<$Res>
    implements $DashboardCreateCardTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateForecastWeatherTileImplCopyWith(
          _$DashboardCreateForecastWeatherTileImpl value,
          $Res Function(_$DashboardCreateForecastWeatherTileImpl) then) =
      __$$DashboardCreateForecastWeatherTileImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      String type});
}

/// @nodoc
class __$$DashboardCreateForecastWeatherTileImplCopyWithImpl<$Res>
    extends _$DashboardCreateCardTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateForecastWeatherTileImpl>
    implements _$$DashboardCreateForecastWeatherTileImplCopyWith<$Res> {
  __$$DashboardCreateForecastWeatherTileImplCopyWithImpl(
      _$DashboardCreateForecastWeatherTileImpl _value,
      $Res Function(_$DashboardCreateForecastWeatherTileImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? dataSource = null,
    Object? type = null,
  }) {
    return _then(_$DashboardCreateForecastWeatherTileImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateForecastWeatherTileImpl
    implements DashboardCreateForecastWeatherTile {
  const _$DashboardCreateForecastWeatherTileImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      this.type = 'weather-forecast'})
      : _dataSource = dataSource;

  factory _$DashboardCreateForecastWeatherTileImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateForecastWeatherTileImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardCreateTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// Specifies the type of tile as a weather forecast tile.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardCreateCardTilesUnion.weatherForecast(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateForecastWeatherTileImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, row, col, rowSpan, colSpan,
      const DeepCollectionEquality().hash(_dataSource), type);

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateForecastWeatherTileImplCopyWith<
          _$DashboardCreateForecastWeatherTileImpl>
      get copyWith => __$$DashboardCreateForecastWeatherTileImplCopyWithImpl<
          _$DashboardCreateForecastWeatherTileImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherForecast,
  }) {
    return weatherForecast(id, row, col, rowSpan, colSpan, dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
  }) {
    return weatherForecast?.call(
        id, row, col, rowSpan, colSpan, dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(id, row, col, rowSpan, colSpan, dataSource, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardCreateDeviceTile value) device,
    required TResult Function(DashboardCreateTimeTile value) clock,
    required TResult Function(DashboardCreateDayWeatherTile value) weatherDay,
    required TResult Function(DashboardCreateForecastWeatherTile value)
        weatherForecast,
  }) {
    return weatherForecast(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateDeviceTile value)? device,
    TResult? Function(DashboardCreateTimeTile value)? clock,
    TResult? Function(DashboardCreateDayWeatherTile value)? weatherDay,
    TResult? Function(DashboardCreateForecastWeatherTile value)?
        weatherForecast,
  }) {
    return weatherForecast?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateDeviceTile value)? device,
    TResult Function(DashboardCreateTimeTile value)? clock,
    TResult Function(DashboardCreateDayWeatherTile value)? weatherDay,
    TResult Function(DashboardCreateForecastWeatherTile value)? weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateForecastWeatherTileImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateForecastWeatherTile
    implements DashboardCreateCardTilesUnion {
  const factory DashboardCreateForecastWeatherTile(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      final String type}) = _$DashboardCreateForecastWeatherTileImpl;

  factory DashboardCreateForecastWeatherTile.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateForecastWeatherTileImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// Specifies the type of tile as a weather forecast tile.
  @override
  String get type;

  /// Create a copy of DashboardCreateCardTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateForecastWeatherTileImplCopyWith<
          _$DashboardCreateForecastWeatherTileImpl>
      get copyWith => throw _privateConstructorUsedError;
}
