export interface JwtPayload {
  sub: string;
  email: string;
  subscription_status: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  display_name: string;
  subscription_status: string;
}
