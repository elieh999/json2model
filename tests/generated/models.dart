class RootModel {
  const RootModel({
    required this.requestId,
    required this.profile,
    required this.items,
  });

  final String requestId;
  final Profile profile;
  final List<Item> items;

  factory RootModel.fromJson(Map<String, dynamic> json) {
    return RootModel(
      requestId: json['request-id'] as String,
      profile: Profile.fromJson(json['profile'] as Map<String, dynamic>),
      items: (json['items'] as List<dynamic>)
          .map((item) => Item.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'request-id': requestId,
      'profile': profile.toJson(),
      'items': items.map((item) => item.toJson()).toList(),
    };
  }
}

class Profile {
  const Profile({required this.displayName, required this.active});

  final String displayName;
  final bool active;

  factory Profile.fromJson(Map<String, dynamic> json) {
    return Profile(
      displayName: json['display-name'] as String,
      active: json['active'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {'display-name': displayName, 'active': active};
  }
}

class Item {
  const Item({required this.sku, required this.quantity, this.note});

  final String sku;
  final int quantity;
  final String? note;

  factory Item.fromJson(Map<String, dynamic> json) {
    return Item(
      sku: json['sku'] as String,
      quantity: json['quantity'] as int,
      note: json['note'] == null ? null : json['note']! as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'sku': sku,
      'quantity': quantity,
      'note': note == null ? null : note!,
    };
  }
}
