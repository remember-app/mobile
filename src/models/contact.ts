import type { UserId } from '@/types/id';

export type Contact = {
  userId: UserId;
  username: string | null;
  name: string | null;
};
