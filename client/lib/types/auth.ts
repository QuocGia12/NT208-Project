export type AuthUser = {
  id: string;
  username: string;
  avatar: string | null;
  elo: number;
  coins: number;
  gems: number;
};

export type RegisterPayload = {
  username: string;
  password: string;
  avatar?: string;
};

export type RegisterResponse = {
  user: AuthUser;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};
