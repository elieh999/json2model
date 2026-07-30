from models import RootModel


payload = {
    "request-id": "req_01J93Y6M",
    "profile": {"display-name": "Ada Lovelace", "active": True},
    "items": [
        {"sku": "DEV-001", "quantity": 2},
        {"sku": "DEV-002", "quantity": 1, "note": "Backordered"},
    ],
}

model = RootModel.model_validate(payload)
assert model.profile.display_name == "Ada Lovelace"
assert model.items[1].note == "Backordered"
assert model.model_dump(by_alias=True)["request-id"] == "req_01J93Y6M"
