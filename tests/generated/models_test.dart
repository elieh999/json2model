import 'models.dart';

void main() {
  final json = <String, dynamic>{
    'request-id': 'req_01J93Y6M',
    'profile': <String, dynamic>{
      'display-name': 'Ada Lovelace',
      'active': true,
    },
    'items': <dynamic>[
      <String, dynamic>{'sku': 'DEV-001', 'quantity': 2},
      <String, dynamic>{'sku': 'DEV-002', 'quantity': 1, 'note': 'Backordered'},
    ],
  };

  final model = RootModel.fromJson(json);
  if (model.profile.displayName != 'Ada Lovelace') {
    throw StateError('Nested model parsing failed');
  }
  if (model.items[1].note != 'Backordered') {
    throw StateError('Optional property parsing failed');
  }
  final encoded = model.toJson();
  if (encoded['request-id'] != 'req_01J93Y6M') {
    throw StateError('Original JSON key was not preserved');
  }
}
