export interface RootModel {
  requestId: string;
  profile: Profile;
  items: Item[];
}

export interface Profile {
  displayName: string;
  active: boolean;
}

export interface Item {
  sku: string;
  quantity: number;
  note?: string;
}
