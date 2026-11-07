export type ApiErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'unauthorized'
  | 'bad_request'
  | 'conflict'
  | 'capacity_exceeded'
  | 'cancelled'
  | 'expired'
  | 'storage_unavailable'
  | 'email_unavailable'
  | 'internal';

export type Page<T> = {
  items: T[];
  nextOffset: number | null;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};
