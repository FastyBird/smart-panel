// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_device_channel_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateDeviceChannelDataSource
    _$DashboardCreateDeviceChannelDataSourceFromJson(
        Map<String, dynamic> json) {
  return _DashboardCreateDeviceChannelDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreateDeviceChannelDataSource {
  /// Unique identifier for the data source (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the data source type
  String get type => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// The unique identifier of the associated channel within the device.
  String get channel => throw _privateConstructorUsedError;

  /// The unique identifier of the associated property within the channel.
  String get property => throw _privateConstructorUsedError;

  /// The icon representing the data source.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateDeviceChannelDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateDeviceChannelDataSourceCopyWith<
          DashboardCreateDeviceChannelDataSource>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateDeviceChannelDataSourceCopyWith<$Res> {
  factory $DashboardCreateDeviceChannelDataSourceCopyWith(
          DashboardCreateDeviceChannelDataSource value,
          $Res Function(DashboardCreateDeviceChannelDataSource) then) =
      _$DashboardCreateDeviceChannelDataSourceCopyWithImpl<$Res,
          DashboardCreateDeviceChannelDataSource>;
  @useResult
  $Res call(
      {String id,
      String type,
      String device,
      String channel,
      String property,
      String? icon});
}

/// @nodoc
class _$DashboardCreateDeviceChannelDataSourceCopyWithImpl<$Res,
        $Val extends DashboardCreateDeviceChannelDataSource>
    implements $DashboardCreateDeviceChannelDataSourceCopyWith<$Res> {
  _$DashboardCreateDeviceChannelDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
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
}

/// @nodoc
abstract class _$$DashboardCreateDeviceChannelDataSourceImplCopyWith<$Res>
    implements $DashboardCreateDeviceChannelDataSourceCopyWith<$Res> {
  factory _$$DashboardCreateDeviceChannelDataSourceImplCopyWith(
          _$DashboardCreateDeviceChannelDataSourceImpl value,
          $Res Function(_$DashboardCreateDeviceChannelDataSourceImpl) then) =
      __$$DashboardCreateDeviceChannelDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String device,
      String channel,
      String property,
      String? icon});
}

/// @nodoc
class __$$DashboardCreateDeviceChannelDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardCreateDeviceChannelDataSourceCopyWithImpl<$Res,
        _$DashboardCreateDeviceChannelDataSourceImpl>
    implements _$$DashboardCreateDeviceChannelDataSourceImplCopyWith<$Res> {
  __$$DashboardCreateDeviceChannelDataSourceImplCopyWithImpl(
      _$DashboardCreateDeviceChannelDataSourceImpl _value,
      $Res Function(_$DashboardCreateDeviceChannelDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardCreateDeviceChannelDataSourceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
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
class _$DashboardCreateDeviceChannelDataSourceImpl
    implements _DashboardCreateDeviceChannelDataSource {
  const _$DashboardCreateDeviceChannelDataSourceImpl(
      {required this.id,
      required this.type,
      required this.device,
      required this.channel,
      required this.property,
      this.icon});

  factory _$DashboardCreateDeviceChannelDataSourceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateDeviceChannelDataSourceImplFromJson(json);

  /// Unique identifier for the data source (optional during creation).
  @override
  final String id;

  /// Discriminator for the data source type
  @override
  final String type;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The unique identifier of the associated channel within the device.
  @override
  final String channel;

  /// The unique identifier of the associated property within the channel.
  @override
  final String property;

  /// The icon representing the data source.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardCreateDeviceChannelDataSource(id: $id, type: $type, device: $device, channel: $channel, property: $property, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateDeviceChannelDataSourceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.property, property) ||
                other.property == property) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, type, device, channel, property, icon);

  /// Create a copy of DashboardCreateDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateDeviceChannelDataSourceImplCopyWith<
          _$DashboardCreateDeviceChannelDataSourceImpl>
      get copyWith =>
          __$$DashboardCreateDeviceChannelDataSourceImplCopyWithImpl<
              _$DashboardCreateDeviceChannelDataSourceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateDeviceChannelDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardCreateDeviceChannelDataSource
    implements DashboardCreateDeviceChannelDataSource {
  const factory _DashboardCreateDeviceChannelDataSource(
      {required final String id,
      required final String type,
      required final String device,
      required final String channel,
      required final String property,
      final String? icon}) = _$DashboardCreateDeviceChannelDataSourceImpl;

  factory _DashboardCreateDeviceChannelDataSource.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateDeviceChannelDataSourceImpl.fromJson;

  /// Unique identifier for the data source (optional during creation).
  @override
  String get id;

  /// Discriminator for the data source type
  @override
  String get type;

  /// The unique identifier of the associated device.
  @override
  String get device;

  /// The unique identifier of the associated channel within the device.
  @override
  String get channel;

  /// The unique identifier of the associated property within the channel.
  @override
  String get property;

  /// The icon representing the data source.
  @override
  String? get icon;

  /// Create a copy of DashboardCreateDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateDeviceChannelDataSourceImplCopyWith<
          _$DashboardCreateDeviceChannelDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
