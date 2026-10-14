/** Transporte de auth. Nunca expone codeHash, attempts ni userId internos. */
export interface RequestCodeDTO {
  email: string;
}

export interface VerifyCodeDTO {
  email: string;
  code: string;
}

export interface AuthTokenDTO {
  token: string;
}
