export enum StudentStatus {
  ACTIVE = "ACTIVE",
  WITHDRAWN = "WITHDRAWN",
  GRADUATED = "GRADUATED",
}

export interface IBranch {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  city: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudent {
  id: string;
  tenantId: string;
  branchId: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  status: StudentStatus;
  createdAt: Date;
  updatedAt: Date;
}
