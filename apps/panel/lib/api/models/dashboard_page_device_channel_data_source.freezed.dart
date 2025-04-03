// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_page_device_channel_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardPageDeviceChannelDataSource
    _$DashboardPageDeviceChannelDataSourceFromJson(Map<String, dynamic> json) {
  return _DashboardPageDeviceChannelDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardPageDeviceChannelDataSource {
  /// A unique identifier for the data source.
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the data source type
  String get type => throw _privateConstructorUsedError;

  /// The timestamp when the data source was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the data source was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// The unique identifier of the associated channel.
  String get channel => throw _privateConstructorUsedError;

  /// The unique identifier of the associated channel property.
  String get property => throw _privateConstructorUsedError;

  /// The icon representing the data source.
  String? get icon => throw _privateConstructorUsedError;

  /// The unique identifier of the associated page.
  String get page => throw _privateConstructorUsedError;

  /// Serializes this DashboardPageDeviceChannelDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardPageDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardPageDeviceChannelDataSourceCopyWith<
          DashboardPageDeviceChannelDataSource>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardPageDeviceChannelDataSourceCopyWith<$Res> {
  factory $DashboardPageDeviceChannelDataSourceCopyWith(
          DashboardPageDeviceChannelDataSource value,
          $Res Function(DashboardPageDeviceChannelDataSource) then) =
      _$DashboardPageDeviceChannelDataSourceCopyWithImpl<$Res,
          DashboardPageDeviceChannelDataSource>;
  @useResult
  $Res call(
      {String id,
      String type,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String channel,
      String property,
      String? icon,
      String page});
}

/// @nodoc
class _$DashboardPageDeviceChannelDataSourceCopyWithImpl<$Res,
        $Val extends DashboardPageDeviceChannelDataSource>
    implements $DashboardPageDeviceChannelDataSourceCopyWith<$Res> {
  _$DashboardPageDeviceChannelDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardPageDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
    Object? page = null,
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
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String,
      property: null == property
          ? _value.property
          : property // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardPageDeviceChannelDataSourceImplCopyWith<$Res>
    implements $DashboardPageDeviceChannelDataSourceCopyWith<$Res> {
  factory _$$DashboardPageDeviceChannelDataSourceImplCopyWith(
          _$DashboardPageDeviceChannelDataSourceImpl value,
          $Res Function(_$DashboardPageDeviceChannelDataSourceImpl) then) =
      __$$DashboardPageDeviceChannelDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String channel,
      String property,
      String? icon,
      String page});
}

/// @nodoc
class __$$DashboardPageDeviceChannelDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardPageDeviceChannelDataSourceCopyWithImpl<$Res,
        _$DashboardPageDeviceChannelDataSourceImpl>
    implements _$$DashboardPageDeviceChannelDataSourceImplCopyWith<$Res> {
  __$$DashboardPageDeviceChannelDataSourceImplCopyWithImpl(
      _$DashboardPageDeviceChannelDataSourceImpl _value,
      $Res Function(_$DashboardPageDeviceChannelDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardPageDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
    Object? page = null,
  }) {
    return _then(_$DashboardPageDeviceChannelDataSourceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String,
      property: null == property
          ? _value.property
          : property // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardPageDeviceChannelDataSourceImpl
    implements _DashboardPageDeviceChannelDataSource {
  const _$DashboardPageDeviceChannelDataSourceImpl(
      {required this.id,
      required this.type,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.device,
      required this.channel,
      required this.property,
      required this.icon,
      required this.page});

  factory _$DashboardPageDeviceChannelDataSourceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardPageDeviceChannelDataSourceImplFromJson(json);

  /// A unique identifier for the data source.
  @override
  final String id;

  /// Discriminator for the data source type
  @override
  final String type;

  /// The timestamp when the data source was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the data source was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The unique identifier of the associated channel.
  @override
  final String channel;

  /// The unique identifier of the associated channel property.
  @override
  final String property;

  /// The icon representing the data source.
  @override
  final String? icon;

  /// The unique identifier of the associated page.
  @override
  final String page;

  @override
  String toString() {
    return 'DashboardPageDeviceChannelDataSource(id: $id, type: $type, createdAt: $createdAt, updatedAt: $updatedAt, device: $device, channel: $channel, property: $property, icon: $icon, page: $page)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardPageDeviceChannelDataSourceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.property, property) ||
                other.property == property) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.page, page) || other.page == page));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type, createdAt, updatedAt,
      device, channel, property, icon, page);

  /// Create a copy of DashboardPageDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardPageDeviceChannelDataSourceImplCopyWith<
          _$DashboardPageDeviceChannelDataSourceImpl>
      get copyWith => __$$DashboardPageDeviceChannelDataSourceImplCopyWithImpl<
          _$DashboardPageDeviceChannelDataSourceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardPageDeviceChannelDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardPageDeviceChannelDataSource
    implements DashboardPageDeviceChannelDataSource {
  const factory _DashboardPageDeviceChannelDataSource(
      {required final String id,
      required final String type,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final String device,
      required final String channel,
      required final String property,
      required final String? icon,
      required final String page}) = _$DashboardPageDeviceChannelDataSourceImpl;

  factory _DashboardPageDeviceChannelDataSource.fromJson(
          Map<String, dynamic> json) =
      _$DashboardPageDeviceChannelDataSourceImpl.fromJson;

  /// A unique identifier for the data source.
  @override
  String get id;

  /// Discriminator for the data source type
  @override
  String get type;

  /// The timestamp when the data source was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the data source was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The unique identifier of the associated device.
  @override
  String get device;

  /// The unique identifier of the associated channel.
  @override
  String get channel;

  /// The unique identifier of the associated channel property.
  @override
  String get property;

  /// The icon representing the data source.
  @override
  String? get icon;

  /// The unique identifier of the associated page.
  @override
  String get page;

  /// Create a copy of DashboardPageDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardPageDeviceChannelDataSourceImplCopyWith<
          _$DashboardPageDeviceChannelDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
