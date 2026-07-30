from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Item(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    sku: str
    quantity: int
    note: str | None = None


class Profile(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    display_name: str = Field(alias="display-name")
    active: bool


class RootModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    request_id: str = Field(alias="request-id")
    profile: Profile
    items: list[Item]
