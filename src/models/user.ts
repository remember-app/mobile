import type { SessionId, UserId } from '@/types/id';

export type User = {
  id: UserId;
  username: string | null;
  name: string | null;
  email: string | null;
};

export type PublicUser = {
  id: UserId;
  username: string | null;
  name: string | null;
};

export type Limits = {
  tokens: number;
  storageBytes: number;
};

export type Account = User & {
  limits: Limits;
};

export type Login = {
  token: string;
  user: User;
};

export type Session = {
  id: SessionId;
  createdAt: Date;
  expiresAt: Date;
  current: boolean;
};
