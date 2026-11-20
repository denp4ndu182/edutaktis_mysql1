/**
 * Safe user profile DTO.
 *
 * This is the boundary between internal user records and HTTP responses.
 * Never expose password hashes, verification state, or authentication data.
 */
type SafeUserSource = {
  id: string;
  email: string;
  namaLengkap: string;
  gelarDepan?: string | null;
  gelarBelakang?: string | null;
  nip?: string | null;
  nuptk?: string | null;
  nomorTelepon?: string | null;
  fotoProfilUrl?: string | null;
  preferensiMataPelajaran?: string | null;
  isActive?: boolean;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

function toIsoString(value?: Date | string | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function toSafeUserProfile(user: SafeUserSource) {
  return {
    id: user.id,
    email: user.email,
    namaLengkap: user.namaLengkap,
    gelarDepan: user.gelarDepan ?? undefined,
    gelarBelakang: user.gelarBelakang ?? undefined,
    nip: user.nip ?? '',
    nuptk: user.nuptk ?? undefined,
    nomorTelepon: user.nomorTelepon ?? undefined,
    fotoProfilUrl: user.fotoProfilUrl ?? undefined,
    preferensiMataPelajaran: user.preferensiMataPelajaran ?? '',
    isActive: user.isActive ?? true,
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
  };
}
