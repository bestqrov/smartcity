export enum TenantType {
  HOTEL = "HOTEL",
  RIAD = "RIAD",
  MAISON_DHOTES = "MAISON_DHOTES",
  RESTAURANT = "RESTAURANT",
  CAFE = "CAFE",
}

export interface ITenantSettings {
  currency: string;
  defaultLocale: string;
  timezone: string;
  features: string[];
}

export interface ITenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  type: TenantType;
  logo?: string;
  settings: ITenantSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
