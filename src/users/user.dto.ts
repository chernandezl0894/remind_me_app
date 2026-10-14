import type { User } from './user.types.js';

/** Transporte público de usuario. */
export interface UserResponseDTO {
  id: string;
  email: string;
  name: string | null;
}

export function toUserResponse(u: User): UserResponseDTO {
  return { id: u.id, email: u.email, name: u.name };
}
