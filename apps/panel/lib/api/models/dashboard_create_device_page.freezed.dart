// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_device_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateDevicePage _$DashboardCreateDevicePageFromJson(
    Map<String, dynamic> json) {
  return _DashboardCreateDevicePage.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreateDevicePage {
  /// The unique identifier for the dashboard page (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// The title of the dashboard page.
  String get title => throw _privateConstructorUsedError;

  /// The position of the page in the dashboard’s list.
  int get order => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// Indicates that this is a device-specific dashboard page.
  String get type => throw _privateConstructorUsedError;

  /// The icon associated with the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateDevicePage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateDevicePageCopyWith<DashboardCreateDevicePage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateDevicePageCopyWith<$Res> {
  factory $DashboardCreateDevicePageCopyWith(DashboardCreateDevicePage value,
          $Res Function(DashboardCreateDevicePage) then) =
      _$DashboardCreateDevicePageCopyWithImpl<$Res, DashboardCreateDevicePage>;
  @useResult
  $Res call(
      {String id,
      String title,
      int order,
      String device,
      String type,
      String? icon});
}

/// @nodoc
class _$DashboardCreateDevicePageCopyWithImpl<$Res,
        $Val extends DashboardCreateDevicePage>
    implements $DashboardCreateDevicePageCopyWith<$Res> {
  _$DashboardCreateDevicePageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? order = null,
    Object? device = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCreateDevicePageImplCopyWith<$Res>
    implements $DashboardCreateDevicePageCopyWith<$Res> {
  factory _$$DashboardCreateDevicePageImplCopyWith(
          _$DashboardCreateDevicePageImpl value,
          $Res Function(_$DashboardCreateDevicePageImpl) then) =
      __$$DashboardCreateDevicePageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      int order,
      String device,
      String type,
      String? icon});
}

/// @nodoc
class __$$DashboardCreateDevicePageImplCopyWithImpl<$Res>
    extends _$DashboardCreateDevicePageCopyWithImpl<$Res,
        _$DashboardCreateDevicePageImpl>
    implements _$$DashboardCreateDevicePageImplCopyWith<$Res> {
  __$$DashboardCreateDevicePageImplCopyWithImpl(
      _$DashboardCreateDevicePageImpl _value,
      $Res Function(_$DashboardCreateDevicePageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? order = null,
    Object? device = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardCreateDevicePageImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
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
class _$DashboardCreateDevicePageImpl implements _DashboardCreateDevicePage {
  const _$DashboardCreateDevicePageImpl(
      {required this.id,
      required this.title,
      required this.order,
      required this.device,
      this.type = 'device',
      this.icon});

  factory _$DashboardCreateDevicePageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardCreateDevicePageImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// The title of the dashboard page.
  @override
  final String title;

  /// The position of the page in the dashboard’s list.
  @override
  final int order;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// Indicates that this is a device-specific dashboard page.
  @override
  @JsonKey()
  final String type;

  /// The icon associated with the dashboard page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardCreateDevicePage(id: $id, title: $title, order: $order, device: $device, type: $type, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateDevicePageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, title, order, device, type, icon);

  /// Create a copy of DashboardCreateDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateDevicePageImplCopyWith<_$DashboardCreateDevicePageImpl>
      get copyWith => __$$DashboardCreateDevicePageImplCopyWithImpl<
          _$DashboardCreateDevicePageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateDevicePageImplToJson(
      this,
    );
  }
}

abstract class _DashboardCreateDevicePage implements DashboardCreateDevicePage {
  const factory _DashboardCreateDevicePage(
      {required final String id,
      required final String title,
      required final int order,
      required final String device,
      final String type,
      final String? icon}) = _$DashboardCreateDevicePageImpl;

  factory _DashboardCreateDevicePage.fromJson(Map<String, dynamic> json) =
      _$DashboardCreateDevicePageImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// The title of the dashboard page.
  @override
  String get title;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// The unique identifier of the associated device.
  @override
  String get device;

  /// Indicates that this is a device-specific dashboard page.
  @override
  String get type;

  /// The icon associated with the dashboard page.
  @override
  String? get icon;

  /// Create a copy of DashboardCreateDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateDevicePageImplCopyWith<_$DashboardCreateDevicePageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
