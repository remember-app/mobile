import type { PageResponse } from './common';
import type { PublicUserResponse } from './user';

export type ContactResponse = {
  contactId: string;
  username: string | null;
  name: string | null;
};

export type ContactsPageResponse = PageResponse<ContactResponse>;

export type SuggestionsPageResponse = PageResponse<PublicUserResponse>;
