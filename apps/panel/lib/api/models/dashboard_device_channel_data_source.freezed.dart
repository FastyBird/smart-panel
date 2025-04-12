// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_device_channel_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardDeviceChannelDataSource _$DashboardDeviceChannelDataSourceFromJson(
    Map<String, dynamic> json) {
  return _DashboardDeviceChannelDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardDeviceChannelDataSource {
  /// A unique identifier for the data source.
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the data source type
  String get type => throw _privateConstructorUsedError;

  /// Discriminator for the data source type
  Parent2 get parent => throw _privateConstructorUsedError;

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

  /// Serializes this DashboardDeviceChannelDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardDeviceChannelDataSourceCopyWith<DashboardDeviceChannelDataSource>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardDeviceChannelDataSourceCopyWith<$Res> {
  factory $DashboardDeviceChannelDataSourceCopyWith(
          DashboardDeviceChannelDataSource value,
          $Res Function(DashboardDeviceChannelDataSource) then) =
      _$DashboardDeviceChannelDataSourceCopyWithImpl<$Res,
          DashboardDeviceChannelDataSource>;
  @useResult
  $Res call(
      {String id,
      String type,
      Parent2 parent,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String channel,
      String property,
      String? icon});

  $Parent2CopyWith<$Res> get parent;
}

/// @nodoc
class _$DashboardDeviceChannelDataSourceCopyWithImpl<$Res,
        $Val extends DashboardDeviceChannelDataSource>
    implements $DashboardDeviceChannelDataSourceCopyWith<$Res> {
  _$DashboardDeviceChannelDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? parent = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
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
      parent: null == parent
          ? _value.parent
          : parent // ignore: cast_nullable_to_non_nullable
              as Parent2,
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
    ) as $Val);
  }

  /// Create a copy of DashboardDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $Parent2CopyWith<$Res> get parent {
    return $Parent2CopyWith<$Res>(_value.parent, (value) {
      return _then(_value.copyWith(parent: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardDeviceChannelDataSourceImplCopyWith<$Res>
    implements $DashboardDeviceChannelDataSourceCopyWith<$Res> {
  factory _$$DashboardDeviceChannelDataSourceImplCopyWith(
          _$DashboardDeviceChannelDataSourceImpl value,
          $Res Function(_$DashboardDeviceChannelDataSourceImpl) then) =
      __$$DashboardDeviceChannelDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      Parent2 parent,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String channel,
      String property,
      String? icon});

  @override
  $Parent2CopyWith<$Res> get parent;
}

/// @nodoc
class __$$DashboardDeviceChannelDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardDeviceChannelDataSourceCopyWithImpl<$Res,
        _$DashboardDeviceChannelDataSourceImpl>
    implements _$$DashboardDeviceChannelDataSourceImplCopyWith<$Res> {
  __$$DashboardDeviceChannelDataSourceImplCopyWithImpl(
      _$DashboardDeviceChannelDataSourceImpl _value,
      $Res Function(_$DashboardDeviceChannelDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? parent = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardDeviceChannelDataSourceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      parent: null == parent
          ? _value.parent
          : parent // ignore: cast_nullable_to_non_nullable
              as Parent2,
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
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardDeviceChannelDataSourceImpl
    implements _DashboardDeviceChannelDataSource {
  const _$DashboardDeviceChannelDataSourceImpl(
      {required this.id,
      required this.type,
      required this.parent,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.device,
      required this.channel,
      required this.property,
      required this.icon});

  factory _$DashboardDeviceChannelDataSourceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardDeviceChannelDataSourceImplFromJson(json);

  /// A unique identifier for the data source.
  @override
  final String id;

  /// Discriminator for the data source type
  @override
  final String type;

  /// Discriminator for the data source type
  @override
  final Parent2 parent;

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

  @override
  String toString() {
    return 'DashboardDeviceChannelDataSource(id: $id, type: $type, parent: $parent, createdAt: $createdAt, updatedAt: $updatedAt, device: $device, channel: $channel, property: $property, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardDeviceChannelDataSourceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.parent, parent) || other.parent == parent) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.property, property) ||
                other.property == property) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type, parent, createdAt,
      updatedAt, device, channel, property, icon);

  /// Create a copy of DashboardDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardDeviceChannelDataSourceImplCopyWith<
          _$DashboardDeviceChannelDataSourceImpl>
      get copyWith => __$$DashboardDeviceChannelDataSourceImplCopyWithImpl<
          _$DashboardDeviceChannelDataSourceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardDeviceChannelDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardDeviceChannelDataSource
    implements DashboardDeviceChannelDataSource {
  const factory _DashboardDeviceChannelDataSource(
      {required final String id,
      required final String type,
      required final Parent2 parent,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final String device,
      required final String channel,
      required final String property,
      required final String? icon}) = _$DashboardDeviceChannelDataSourceImpl;

  factory _DashboardDeviceChannelDataSource.fromJson(
          Map<String, dynamic> json) =
      _$DashboardDeviceChannelDataSourceImpl.fromJson;

  /// A unique identifier for the data source.
  @override
  String get id;

  /// Discriminator for the data source type
  @override
  String get type;

  /// Discriminator for the data source type
  @override
  Parent2 get parent;

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

  /// Create a copy of DashboardDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardDeviceChannelDataSourceImplCopyWith<
          _$DashboardDeviceChannelDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
