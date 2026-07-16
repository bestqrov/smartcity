export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  STAFF = "STAFF",
  GUEST = "GUEST",
}

export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  tenantId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface ILoginResponse {
  accessToken: string;
  refreshToken: string;
  user: IUser;
}

export interface IRegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tenantId: string;
  role?: UserRole;
}

export interface ITokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
  iat: number;
  exp: number;
}
