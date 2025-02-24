// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_tiles_page_tiles_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateTilesPageTilesUnion _$DashboardCreateTilesPageTilesUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'device':
      return DashboardCreateTilesPageTilesUnionDevice.fromJson(json);
    case 'clock':
      return DashboardCreateTilesPageTilesUnionClock.fromJson(json);
    case 'weather-day':
      return DashboardCreateTilesPageTilesUnionWeatherDay.fromJson(json);
    case 'weather-forecast':
      return DashboardCreateTilesPageTilesUnionWeatherForecast.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'DashboardCreateTilesPageTilesUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardCreateTilesPageTilesUnion {
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
    required TResult Function(DashboardCreateTilesPageTilesUnionDevice value)
        device,
    required TResult Function(DashboardCreateTilesPageTilesUnionClock value)
        clock,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherForecast value)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateTilesPageTilesUnionDevice value)? device,
    TResult? Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateTilesPageTilesUnionDevice value)? device,
    TResult Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateTilesPageTilesUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateTilesPageTilesUnionCopyWith<
          DashboardCreateTilesPageTilesUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateTilesPageTilesUnionCopyWith<$Res> {
  factory $DashboardCreateTilesPageTilesUnionCopyWith(
          DashboardCreateTilesPageTilesUnion value,
          $Res Function(DashboardCreateTilesPageTilesUnion) then) =
      _$DashboardCreateTilesPageTilesUnionCopyWithImpl<$Res,
          DashboardCreateTilesPageTilesUnion>;
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
class _$DashboardCreateTilesPageTilesUnionCopyWithImpl<$Res,
        $Val extends DashboardCreateTilesPageTilesUnion>
    implements $DashboardCreateTilesPageTilesUnionCopyWith<$Res> {
  _$DashboardCreateTilesPageTilesUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateTilesPageTilesUnion
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
abstract class _$$DashboardCreateTilesPageTilesUnionDeviceImplCopyWith<$Res>
    implements $DashboardCreateTilesPageTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateTilesPageTilesUnionDeviceImplCopyWith(
          _$DashboardCreateTilesPageTilesUnionDeviceImpl value,
          $Res Function(_$DashboardCreateTilesPageTilesUnionDeviceImpl) then) =
      __$$DashboardCreateTilesPageTilesUnionDeviceImplCopyWithImpl<$Res>;
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
class __$$DashboardCreateTilesPageTilesUnionDeviceImplCopyWithImpl<$Res>
    extends _$DashboardCreateTilesPageTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateTilesPageTilesUnionDeviceImpl>
    implements _$$DashboardCreateTilesPageTilesUnionDeviceImplCopyWith<$Res> {
  __$$DashboardCreateTilesPageTilesUnionDeviceImplCopyWithImpl(
      _$DashboardCreateTilesPageTilesUnionDeviceImpl _value,
      $Res Function(_$DashboardCreateTilesPageTilesUnionDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateTilesPageTilesUnion
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
    return _then(_$DashboardCreateTilesPageTilesUnionDeviceImpl(
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
class _$DashboardCreateTilesPageTilesUnionDeviceImpl
    implements DashboardCreateTilesPageTilesUnionDevice {
  const _$DashboardCreateTilesPageTilesUnionDeviceImpl(
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

  factory _$DashboardCreateTilesPageTilesUnionDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateTilesPageTilesUnionDeviceImplFromJson(json);

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
    return 'DashboardCreateTilesPageTilesUnion.device(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, device: $device, icon: $icon, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateTilesPageTilesUnionDeviceImpl &&
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

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateTilesPageTilesUnionDeviceImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionDeviceImpl>
      get copyWith =>
          __$$DashboardCreateTilesPageTilesUnionDeviceImplCopyWithImpl<
              _$DashboardCreateTilesPageTilesUnionDeviceImpl>(this, _$identity);

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
    required TResult Function(DashboardCreateTilesPageTilesUnionDevice value)
        device,
    required TResult Function(DashboardCreateTilesPageTilesUnionClock value)
        clock,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherForecast value)
        weatherForecast,
  }) {
    return device(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateTilesPageTilesUnionDevice value)? device,
    TResult? Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return device?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateTilesPageTilesUnionDevice value)? device,
    TResult Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateTilesPageTilesUnionDeviceImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateTilesPageTilesUnionDevice
    implements DashboardCreateTilesPageTilesUnion {
  const factory DashboardCreateTilesPageTilesUnionDevice(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      required final String device,
      final String? icon,
      final String type}) = _$DashboardCreateTilesPageTilesUnionDeviceImpl;

  factory DashboardCreateTilesPageTilesUnionDevice.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateTilesPageTilesUnionDeviceImpl.fromJson;

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

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateTilesPageTilesUnionDeviceImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardCreateTilesPageTilesUnionClockImplCopyWith<$Res>
    implements $DashboardCreateTilesPageTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateTilesPageTilesUnionClockImplCopyWith(
          _$DashboardCreateTilesPageTilesUnionClockImpl value,
          $Res Function(_$DashboardCreateTilesPageTilesUnionClockImpl) then) =
      __$$DashboardCreateTilesPageTilesUnionClockImplCopyWithImpl<$Res>;
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
class __$$DashboardCreateTilesPageTilesUnionClockImplCopyWithImpl<$Res>
    extends _$DashboardCreateTilesPageTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateTilesPageTilesUnionClockImpl>
    implements _$$DashboardCreateTilesPageTilesUnionClockImplCopyWith<$Res> {
  __$$DashboardCreateTilesPageTilesUnionClockImplCopyWithImpl(
      _$DashboardCreateTilesPageTilesUnionClockImpl _value,
      $Res Function(_$DashboardCreateTilesPageTilesUnionClockImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateTilesPageTilesUnion
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
    return _then(_$DashboardCreateTilesPageTilesUnionClockImpl(
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
class _$DashboardCreateTilesPageTilesUnionClockImpl
    implements DashboardCreateTilesPageTilesUnionClock {
  const _$DashboardCreateTilesPageTilesUnionClockImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      this.type = 'clock'})
      : _dataSource = dataSource;

  factory _$DashboardCreateTilesPageTilesUnionClockImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateTilesPageTilesUnionClockImplFromJson(json);

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
    return 'DashboardCreateTilesPageTilesUnion.clock(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateTilesPageTilesUnionClockImpl &&
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

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateTilesPageTilesUnionClockImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionClockImpl>
      get copyWith =>
          __$$DashboardCreateTilesPageTilesUnionClockImplCopyWithImpl<
              _$DashboardCreateTilesPageTilesUnionClockImpl>(this, _$identity);

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
    required TResult Function(DashboardCreateTilesPageTilesUnionDevice value)
        device,
    required TResult Function(DashboardCreateTilesPageTilesUnionClock value)
        clock,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherForecast value)
        weatherForecast,
  }) {
    return clock(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateTilesPageTilesUnionDevice value)? device,
    TResult? Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return clock?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateTilesPageTilesUnionDevice value)? device,
    TResult Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateTilesPageTilesUnionClockImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateTilesPageTilesUnionClock
    implements DashboardCreateTilesPageTilesUnion {
  const factory DashboardCreateTilesPageTilesUnionClock(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      final String type}) = _$DashboardCreateTilesPageTilesUnionClockImpl;

  factory DashboardCreateTilesPageTilesUnionClock.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateTilesPageTilesUnionClockImpl.fromJson;

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

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateTilesPageTilesUnionClockImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionClockImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWith<$Res>
    implements $DashboardCreateTilesPageTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWith(
          _$DashboardCreateTilesPageTilesUnionWeatherDayImpl value,
          $Res Function(_$DashboardCreateTilesPageTilesUnionWeatherDayImpl)
              then) =
      __$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWithImpl<$Res>;
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
class __$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWithImpl<$Res>
    extends _$DashboardCreateTilesPageTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateTilesPageTilesUnionWeatherDayImpl>
    implements
        _$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWith<$Res> {
  __$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWithImpl(
      _$DashboardCreateTilesPageTilesUnionWeatherDayImpl _value,
      $Res Function(_$DashboardCreateTilesPageTilesUnionWeatherDayImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateTilesPageTilesUnion
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
    return _then(_$DashboardCreateTilesPageTilesUnionWeatherDayImpl(
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
class _$DashboardCreateTilesPageTilesUnionWeatherDayImpl
    implements DashboardCreateTilesPageTilesUnionWeatherDay {
  const _$DashboardCreateTilesPageTilesUnionWeatherDayImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      this.type = 'weather-day'})
      : _dataSource = dataSource;

  factory _$DashboardCreateTilesPageTilesUnionWeatherDayImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateTilesPageTilesUnionWeatherDayImplFromJson(json);

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
    return 'DashboardCreateTilesPageTilesUnion.weatherDay(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateTilesPageTilesUnionWeatherDayImpl &&
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

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionWeatherDayImpl>
      get copyWith =>
          __$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWithImpl<
                  _$DashboardCreateTilesPageTilesUnionWeatherDayImpl>(
              this, _$identity);

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
    required TResult Function(DashboardCreateTilesPageTilesUnionDevice value)
        device,
    required TResult Function(DashboardCreateTilesPageTilesUnionClock value)
        clock,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherDay(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateTilesPageTilesUnionDevice value)? device,
    TResult? Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherDay?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateTilesPageTilesUnionDevice value)? device,
    TResult Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateTilesPageTilesUnionWeatherDayImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateTilesPageTilesUnionWeatherDay
    implements DashboardCreateTilesPageTilesUnion {
  const factory DashboardCreateTilesPageTilesUnionWeatherDay(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      final String type}) = _$DashboardCreateTilesPageTilesUnionWeatherDayImpl;

  factory DashboardCreateTilesPageTilesUnionWeatherDay.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateTilesPageTilesUnionWeatherDayImpl.fromJson;

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

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionWeatherDayImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWith<
    $Res> implements $DashboardCreateTilesPageTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWith(
          _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl value,
          $Res Function(_$DashboardCreateTilesPageTilesUnionWeatherForecastImpl)
              then) =
      __$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWithImpl<
          $Res>;
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
class __$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWithImpl<
        $Res>
    extends _$DashboardCreateTilesPageTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl>
    implements
        _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWith<$Res> {
  __$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWithImpl(
      _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl _value,
      $Res Function(_$DashboardCreateTilesPageTilesUnionWeatherForecastImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateTilesPageTilesUnion
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
    return _then(_$DashboardCreateTilesPageTilesUnionWeatherForecastImpl(
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
class _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl
    implements DashboardCreateTilesPageTilesUnionWeatherForecast {
  const _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      this.type = 'weather-forecast'})
      : _dataSource = dataSource;

  factory _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplFromJson(json);

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
    return 'DashboardCreateTilesPageTilesUnion.weatherForecast(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl &&
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

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl>
      get copyWith =>
          __$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWithImpl<
                  _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl>(
              this, _$identity);

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
    required TResult Function(DashboardCreateTilesPageTilesUnionDevice value)
        device,
    required TResult Function(DashboardCreateTilesPageTilesUnionClock value)
        clock,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherForecast(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateTilesPageTilesUnionDevice value)? device,
    TResult? Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherForecast?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateTilesPageTilesUnionDevice value)? device,
    TResult Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateTilesPageTilesUnionWeatherForecast
    implements DashboardCreateTilesPageTilesUnion {
  const factory DashboardCreateTilesPageTilesUnionWeatherForecast(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      final String
          type}) = _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl;

  factory DashboardCreateTilesPageTilesUnionWeatherForecast.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl.fromJson;

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

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl>
      get copyWith => throw _privateConstructorUsedError;
}
