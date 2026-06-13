export interface UserDto {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  roles: string[];
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  user: UserDto;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

export interface ProductRequest {
  name: string;
  sku: string;
  description: string | null;
  price: number;
  isActive: boolean;
}

export interface UserListItem {
  id: string;
  email: string;
  fullName: string | null;
  roles: string[];
  isDeleted: boolean;
  createdAtUtc: string;
}

/** Body lỗi chuẩn ProblemDetails từ backend (Result pattern). */
export interface ApiProblem {
  status: number;
  title: string;
  detail: string;
}

export const ROLE_ADMIN = 'Admin';
export const ROLE_USER = 'User';
