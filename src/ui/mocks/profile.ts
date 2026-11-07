export type MockProfile = {
  name: string;
  username: string;
  email: string;
  avatarUri: string | null;
  storageUsedGb: number;
  storageTotalGb: number;
  tokens: number;
};

let profile: MockProfile = {
  name: 'Анна Петрова',
  username: 'anna',
  email: 'anna@example.com',
  avatarUri: null,
  storageUsedGb: 3.6,
  storageTotalGb: 10,
  tokens: 120,
};

const listeners = new Set<() => void>();

export const profileState = () => profile;

export function isRegisteredEmail(email: string): boolean {
  return email.trim().toLowerCase() === profile.email;
}

export function subscribeProfile(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function setAvatar(uri: string | null): void {
  profile = { ...profile, avatarUri: uri };
  emit();
}

export function saveProfile(next: Pick<MockProfile, 'name' | 'username'>): void {
  profile = { ...profile, ...next };
  emit();
}

export function donateStorage(gigabytes: number): boolean {
  if (gigabytes <= 0) return false;
  if (profile.storageTotalGb - profile.storageUsedGb < gigabytes) return false;
  profile = { ...profile, storageTotalGb: profile.storageTotalGb - gigabytes };
  emit();
  return true;
}

export function donateTokens(tokens: number): boolean {
  if (tokens <= 0 || profile.tokens < tokens) return false;
  profile = { ...profile, tokens: profile.tokens - tokens };
  emit();
  return true;
}
