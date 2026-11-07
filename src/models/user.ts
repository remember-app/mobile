import type { SessionId, UserId } from '@/types/id';

export type Language = 'ru' | 'en';

export type Consumable = {
  tokens: {
    tokens: number;
    spend: number;
  };
  storage: {
    bytes: number;
    spend: number;
  };
};

export type User = {
  id: UserId;
  username: string | null;
  name: string | null;
  email: string | null;
  language: Language;
  profileMediaId: string | null;
};

export type PublicUser = {
  id: UserId;
  username: string | null;
  name: string | null;
  profileMediaId: string | null;
};

export type Account = User & {
  consumables: Consumable;
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
