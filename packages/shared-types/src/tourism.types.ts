import { TenantType } from "./tenant.types";

// ─── Room Types ──────────────────────────────────────────────────────────────

export enum RoomType {
  SINGLE = "SINGLE",
  DOUBLE = "DOUBLE",
  SUITE = "SUITE",
  FAMILY = "FAMILY",
  DELUXE = "DELUXE",
}

// ─── Activity Types ──────────────────────────────────────────────────────────

export enum ActivityType {
  EXCURSION = "EXCURSION",
  QUAD = "QUAD",
  SPA = "SPA",
  SAUNA = "SAUNA",
  HAMMAM = "HAMMAM",
  POOL = "POOL",
  GUIDED_TOUR = "GUIDED_TOUR",
  COOKING_CLASS = "COOKING_CLASS",
}

// ─── Booking Status ──────────────────────────────────────────────────────────

export enum BookingStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  CHECKED_OUT = "CHECKED_OUT",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

// ─── Order Status ────────────────────────────────────────────────────────────

export enum OrderStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

// ─── Hotel ───────────────────────────────────────────────────────────────────

export interface IHotel {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  type: TenantType;
  address: string;
  city: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  images: string[];
  amenities: string[];
  rating: number;
  reviewCount: number;
  priceRange: string;
  contactPhone: string;
  contactEmail: string;
  isActive: boolean;
}

// ─── Room ────────────────────────────────────────────────────────────────────

export interface IRoom {
  id: string;
  hotelId: string;
  name: string;
  type: RoomType;
  description: string;
  price: number;
  currency: string;
  capacity: number;
  amenities: string[];
  images: string[];
  isAvailable: boolean;
}

// ─── Restaurant ──────────────────────────────────────────────────────────────

export interface IRestaurant {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  cuisine: string;
  address: string;
  city: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  images: string[];
  rating: number;
  reviewCount: number;
  priceRange: string;
  contactPhone: string;
  contactEmail: string;
  openingHours: string;
  isActive: boolean;
}

// ─── Activity ────────────────────────────────────────────────────────────────

export interface IActivity {
  id: string;
  hotelId: string;
  name: string;
  type: ActivityType;
  description: string;
  price: number;
  duration: string;
  images: string[];
  maxParticipants: number;
  isAvailable: boolean;
}

// ─── Service Order ───────────────────────────────────────────────────────────

export interface IServiceOrder {
  id: string;
  bookingId: string;
  type: string;
  description: string;
  quantity: number;
  price: number;
  status: OrderStatus;
}

// ─── Booking ─────────────────────────────────────────────────────────────────

export interface IBooking {
  id: string;
  guestId: string;
  hotelId: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  status: BookingStatus;
  totalPrice: number;
  qrCode: string;
  services: IServiceOrder[];
}

// ─── Review ──────────────────────────────────────────────────────────────────

export interface IReview {
  id: string;
  guestId: string;
  hotelId: string;
  rating: number;
  comment: string;
  categories: {
    cleanliness: number;
    service: number;
    location: number;
    value: number;
  };
  createdAt: Date;
}

// ─── QR Payload ──────────────────────────────────────────────────────────────

export interface IQRPayload {
  type: "checkin" | "wifi" | "menu" | "service";
  tenantId: string;
  data: Record<string, unknown>;
}
