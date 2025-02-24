// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_create_card_tile_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqCreateCardTileDataUnion
    _$DashboardReqCreateCardTileDataUnionFromJson(Map<String, dynamic> json) {
  switch (json['type']) {
    case 'device':
      return DashboardReqCreateCardTileDataUnionDevice.fromJson(json);
    case 'clock':
      return DashboardReqCreateCardTileDataUnionClock.fromJson(json);
    case 'weather-day':
      return DashboardReqCreateCardTileDataUnionWeatherDay.fromJson(json);
    case 'weather-forecast':
      return DashboardReqCreateCardTileDataUnionWeatherForecast.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'DashboardReqCreateCardTileDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardReqCreateCardTileDataUnion {
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
    required TResult Function(DashboardReqCreateCardTileDataUnionDevice value)
        device,
    required TResult Function(DashboardReqCreateCardTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreateCardTileDataUnionDevice value)? device,
    TResult? Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreateCardTileDataUnionDevice value)? device,
    TResult Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqCreateCardTileDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqCreateCardTileDataUnionCopyWith<
          DashboardReqCreateCardTileDataUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqCreateCardTileDataUnionCopyWith<$Res> {
  factory $DashboardReqCreateCardTileDataUnionCopyWith(
          DashboardReqCreateCardTileDataUnion value,
          $Res Function(DashboardReqCreateCardTileDataUnion) then) =
      _$DashboardReqCreateCardTileDataUnionCopyWithImpl<$Res,
          DashboardReqCreateCardTileDataUnion>;
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
class _$DashboardReqCreateCardTileDataUnionCopyWithImpl<$Res,
        $Val extends DashboardReqCreateCardTileDataUnion>
    implements $DashboardReqCreateCardTileDataUnionCopyWith<$Res> {
  _$DashboardReqCreateCardTileDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqCreateCardTileDataUnion
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
abstract class _$$DashboardReqCreateCardTileDataUnionDeviceImplCopyWith<$Res>
    implements $DashboardReqCreateCardTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreateCardTileDataUnionDeviceImplCopyWith(
          _$DashboardReqCreateCardTileDataUnionDeviceImpl value,
          $Res Function(_$DashboardReqCreateCardTileDataUnionDeviceImpl) then) =
      __$$DashboardReqCreateCardTileDataUnionDeviceImplCopyWithImpl<$Res>;
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
class __$$DashboardReqCreateCardTileDataUnionDeviceImplCopyWithImpl<$Res>
    extends _$DashboardReqCreateCardTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreateCardTileDataUnionDeviceImpl>
    implements _$$DashboardReqCreateCardTileDataUnionDeviceImplCopyWith<$Res> {
  __$$DashboardReqCreateCardTileDataUnionDeviceImplCopyWithImpl(
      _$DashboardReqCreateCardTileDataUnionDeviceImpl _value,
      $Res Function(_$DashboardReqCreateCardTileDataUnionDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreateCardTileDataUnion
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
    return _then(_$DashboardReqCreateCardTileDataUnionDeviceImpl(
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
class _$DashboardReqCreateCardTileDataUnionDeviceImpl
    implements DashboardReqCreateCardTileDataUnionDevice {
  const _$DashboardReqCreateCardTileDataUnionDeviceImpl(
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

  factory _$DashboardReqCreateCardTileDataUnionDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreateCardTileDataUnionDeviceImplFromJson(json);

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
    return 'DashboardReqCreateCardTileDataUnion.device(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, device: $device, icon: $icon, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreateCardTileDataUnionDeviceImpl &&
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

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreateCardTileDataUnionDeviceImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionDeviceImpl>
      get copyWith =>
          __$$DashboardReqCreateCardTileDataUnionDeviceImplCopyWithImpl<
                  _$DashboardReqCreateCardTileDataUnionDeviceImpl>(
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
    required TResult Function(DashboardReqCreateCardTileDataUnionDevice value)
        device,
    required TResult Function(DashboardReqCreateCardTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return device(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreateCardTileDataUnionDevice value)? device,
    TResult? Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return device?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreateCardTileDataUnionDevice value)? device,
    TResult Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
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
    return _$$DashboardReqCreateCardTileDataUnionDeviceImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreateCardTileDataUnionDevice
    implements DashboardReqCreateCardTileDataUnion {
  const factory DashboardReqCreateCardTileDataUnionDevice(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      required final String device,
      final String? icon,
      final String type}) = _$DashboardReqCreateCardTileDataUnionDeviceImpl;

  factory DashboardReqCreateCardTileDataUnionDevice.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreateCardTileDataUnionDeviceImpl.fromJson;

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

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreateCardTileDataUnionDeviceImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqCreateCardTileDataUnionClockImplCopyWith<$Res>
    implements $DashboardReqCreateCardTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreateCardTileDataUnionClockImplCopyWith(
          _$DashboardReqCreateCardTileDataUnionClockImpl value,
          $Res Function(_$DashboardReqCreateCardTileDataUnionClockImpl) then) =
      __$$DashboardReqCreateCardTileDataUnionClockImplCopyWithImpl<$Res>;
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
class __$$DashboardReqCreateCardTileDataUnionClockImplCopyWithImpl<$Res>
    extends _$DashboardReqCreateCardTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreateCardTileDataUnionClockImpl>
    implements _$$DashboardReqCreateCardTileDataUnionClockImplCopyWith<$Res> {
  __$$DashboardReqCreateCardTileDataUnionClockImplCopyWithImpl(
      _$DashboardReqCreateCardTileDataUnionClockImpl _value,
      $Res Function(_$DashboardReqCreateCardTileDataUnionClockImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreateCardTileDataUnion
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
    return _then(_$DashboardReqCreateCardTileDataUnionClockImpl(
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
class _$DashboardReqCreateCardTileDataUnionClockImpl
    implements DashboardReqCreateCardTileDataUnionClock {
  const _$DashboardReqCreateCardTileDataUnionClockImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      this.type = 'clock'})
      : _dataSource = dataSource;

  factory _$DashboardReqCreateCardTileDataUnionClockImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreateCardTileDataUnionClockImplFromJson(json);

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
    return 'DashboardReqCreateCardTileDataUnion.clock(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreateCardTileDataUnionClockImpl &&
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

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreateCardTileDataUnionClockImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionClockImpl>
      get copyWith =>
          __$$DashboardReqCreateCardTileDataUnionClockImplCopyWithImpl<
              _$DashboardReqCreateCardTileDataUnionClockImpl>(this, _$identity);

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
    required TResult Function(DashboardReqCreateCardTileDataUnionDevice value)
        device,
    required TResult Function(DashboardReqCreateCardTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return clock(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreateCardTileDataUnionDevice value)? device,
    TResult? Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return clock?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreateCardTileDataUnionDevice value)? device,
    TResult Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
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
    return _$$DashboardReqCreateCardTileDataUnionClockImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreateCardTileDataUnionClock
    implements DashboardReqCreateCardTileDataUnion {
  const factory DashboardReqCreateCardTileDataUnionClock(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      final String type}) = _$DashboardReqCreateCardTileDataUnionClockImpl;

  factory DashboardReqCreateCardTileDataUnionClock.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreateCardTileDataUnionClockImpl.fromJson;

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

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreateCardTileDataUnionClockImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionClockImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWith<
    $Res> implements $DashboardReqCreateCardTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWith(
          _$DashboardReqCreateCardTileDataUnionWeatherDayImpl value,
          $Res Function(_$DashboardReqCreateCardTileDataUnionWeatherDayImpl)
              then) =
      __$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWithImpl<$Res>;
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
class __$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWithImpl<$Res>
    extends _$DashboardReqCreateCardTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreateCardTileDataUnionWeatherDayImpl>
    implements
        _$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWith<$Res> {
  __$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWithImpl(
      _$DashboardReqCreateCardTileDataUnionWeatherDayImpl _value,
      $Res Function(_$DashboardReqCreateCardTileDataUnionWeatherDayImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreateCardTileDataUnion
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
    return _then(_$DashboardReqCreateCardTileDataUnionWeatherDayImpl(
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
class _$DashboardReqCreateCardTileDataUnionWeatherDayImpl
    implements DashboardReqCreateCardTileDataUnionWeatherDay {
  const _$DashboardReqCreateCardTileDataUnionWeatherDayImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      this.type = 'weather-day'})
      : _dataSource = dataSource;

  factory _$DashboardReqCreateCardTileDataUnionWeatherDayImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreateCardTileDataUnionWeatherDayImplFromJson(json);

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
    return 'DashboardReqCreateCardTileDataUnion.weatherDay(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreateCardTileDataUnionWeatherDayImpl &&
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

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionWeatherDayImpl>
      get copyWith =>
          __$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWithImpl<
                  _$DashboardReqCreateCardTileDataUnionWeatherDayImpl>(
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
    required TResult Function(DashboardReqCreateCardTileDataUnionDevice value)
        device,
    required TResult Function(DashboardReqCreateCardTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherDay(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreateCardTileDataUnionDevice value)? device,
    TResult? Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherDay?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreateCardTileDataUnionDevice value)? device,
    TResult Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
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
    return _$$DashboardReqCreateCardTileDataUnionWeatherDayImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreateCardTileDataUnionWeatherDay
    implements DashboardReqCreateCardTileDataUnion {
  const factory DashboardReqCreateCardTileDataUnionWeatherDay(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      final String type}) = _$DashboardReqCreateCardTileDataUnionWeatherDayImpl;

  factory DashboardReqCreateCardTileDataUnionWeatherDay.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreateCardTileDataUnionWeatherDayImpl.fromJson;

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

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreateCardTileDataUnionWeatherDayImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionWeatherDayImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWith<
    $Res> implements $DashboardReqCreateCardTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWith(
          _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl value,
          $Res Function(
                  _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl)
              then) =
      __$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWithImpl<
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
class __$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWithImpl<
        $Res>
    extends _$DashboardReqCreateCardTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl>
    implements
        _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWith<
            $Res> {
  __$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWithImpl(
      _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl _value,
      $Res Function(_$DashboardReqCreateCardTileDataUnionWeatherForecastImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreateCardTileDataUnion
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
    return _then(_$DashboardReqCreateCardTileDataUnionWeatherForecastImpl(
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
class _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl
    implements DashboardReqCreateCardTileDataUnionWeatherForecast {
  const _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      this.type = 'weather-forecast'})
      : _dataSource = dataSource;

  factory _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplFromJson(json);

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
    return 'DashboardReqCreateCardTileDataUnion.weatherForecast(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl &&
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

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl>
      get copyWith =>
          __$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWithImpl<
                  _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl>(
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
    required TResult Function(DashboardReqCreateCardTileDataUnionDevice value)
        device,
    required TResult Function(DashboardReqCreateCardTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreateCardTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherForecast(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreateCardTileDataUnionDevice value)? device,
    TResult? Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherForecast?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreateCardTileDataUnionDevice value)? device,
    TResult Function(DashboardReqCreateCardTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreateCardTileDataUnionWeatherForecast value)?
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
    return _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreateCardTileDataUnionWeatherForecast
    implements DashboardReqCreateCardTileDataUnion {
  const factory DashboardReqCreateCardTileDataUnionWeatherForecast(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      final String
          type}) = _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl;

  factory DashboardReqCreateCardTileDataUnionWeatherForecast.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl.fromJson;

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

  /// Create a copy of DashboardReqCreateCardTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreateCardTileDataUnionWeatherForecastImplCopyWith<
          _$DashboardReqCreateCardTileDataUnionWeatherForecastImpl>
      get copyWith => throw _privateConstructorUsedError;
}
