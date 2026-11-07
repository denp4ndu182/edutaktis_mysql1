import {
  UserProfile,
  InstitutionProfile,
  InstitutionMembership,
  InstitutionRole,
  TenantContext,
  MasterInputData,
} from '../types';

export const STORAGE_KEY_USERS = 'kbc_users_v2';
export const STORAGE_KEY_CURRENT_USER_ID = 'kbc_current_user_id_v2';
export const STORAGE_KEY_INSTITUTIONS = 'kbc_institutions_v2';
export const STORAGE_KEY_MEMBERSHIPS = 'kbc_memberships_v2';
export const STORAGE_KEY_ACTIVE_INSTITUTION_ID = 'kbc_active_institution_id_v2';

// 1. Initial Seed Data
export const SEED_USERS: UserProfile[] = [
  {
    id: 'usr_pandu_001',
    namaLengkap: 'Pandu Kusumahadi',
    gelarDepan: '',
    gelarBelakang: 'S.Kom',
    nip: '198703252023211023',
    nuptk: '4239765666130122',
    email: 'pandu.kusumahadi@kemenag.go.id',
    nomorTelepon: '081234567890',
    fotoProfilUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    preferensiMataPelajaran: 'Koding dan Kecerdasan Artifisial',
    createdAt: '2024-01-10T08:00:00.000Z',
    updatedAt: new Date().toISOString(),
    // Backward compatibility getters/fields
    namaGuru: 'Pandu Kusumahadi, S.Kom',
    nipGuru: '198703252023211023',
    mataPelajaran: 'Koding dan Kecerdasan Artifisial',
    kodeMapel: 'KBC-AI',
    fase: 'Fase E',
    kelas: 'Kelas X',
    tahunPelajaran: '2024/2025',
    namaMadrasah: 'MAN 1 Gunungkidul',
  },
  {
    id: 'usr_kholis_002',
    namaLengkap: 'H. Kholis Muhajir',
    gelarDepan: '',
    gelarBelakang: 'S.Ag., M.S.I.',
    nip: '197505122003121003',
    nuptk: '3157753655200002',
    email: 'kholis.muhajir@kemenag.go.id',
    nomorTelepon: '081328901234',
    preferensiMataPelajaran: 'Pendidikan Agama Islam',
    createdAt: '2024-01-10T08:00:00.000Z',
    updatedAt: new Date().toISOString(),
    namaGuru: 'H. Kholis Muhajir, S.Ag., M.S.I.',
    nipGuru: '197505122003121003',
    mataPelajaran: 'Pendidikan Agama Islam',
    kodeMapel: 'PAI-KBC',
    fase: 'Fase E',
    kelas: 'Kelas X',
    tahunPelajaran: '2024/2025',
    namaMadrasah: 'MAN 1 Gunungkidul',
  },
  {
    id: 'usr_siti_003',
    namaLengkap: 'Dra. Hj. Siti Aminah',
    gelarDepan: '',
    gelarBelakang: 'M.Pd.',
    nip: '197906152005012004',
    nuptk: '5441757659300013',
    email: 'siti.aminah@kemenag.go.id',
    nomorTelepon: '081578123456',
    preferensiMataPelajaran: 'Informatika',
    createdAt: '2024-02-15T09:30:00.000Z',
    updatedAt: new Date().toISOString(),
    namaGuru: 'Dra. Hj. Siti Aminah, M.Pd.',
    nipGuru: '197906152005012004',
    mataPelajaran: 'Informatika',
    kodeMapel: 'INF-MTs',
    fase: 'Fase D',
    kelas: 'Kelas VII',
    tahunPelajaran: '2024/2025',
    namaMadrasah: 'MTsN 2 Bantul',
  },
];

export const SEED_INSTITUTIONS: InstitutionProfile[] = [
  {
    id: 'inst_man1gk',
    namaResmi: 'Madrasah Aliyah Negeri 1 Gunungkidul',
    namaSingkat: 'MAN 1 Gunungkidul',
    jenjang: 'MA',
    jenisInstitusi: 'Negeri',
    npsn: '20400012',
    kementerianDinas: 'Kementerian Agama Republik Indonesia / Kantor Wilayah D.I. Yogyakarta',
    alamatLengkap: 'Jl. KH. Agus Salim No. 65, Ledoksari',
    kelurahanDesa: 'Kepek',
    kecamatan: 'Wonosari',
    kabupatenKota: 'Kab. Gunungkidul',
    provinsi: 'D.I. Yogyakarta',
    kodePos: '55813',
    telepon: '(0274) 391032',
    email: 'man1gunungkidul@kemenag.go.id',
    website: 'https://man1gunungkidul.sch.id',
    logoUrl: '',
    namaKepala: 'H. Kholis Muhajir, S.Ag., M.S.I.',
    nipKepala: '197505122003121003',
    kotaTandaTangan: 'Gunungkidul',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inst_mtsn2btl',
    namaResmi: 'Madrasah Tsanawiyah Negeri 2 Bantul',
    namaSingkat: 'MTsN 2 Bantul',
    jenjang: 'MTs',
    jenisInstitusi: 'Negeri',
    npsn: '20400234',
    kementerianDinas: 'Kementerian Agama Republik Indonesia / Kantor Wilayah D.I. Yogyakarta',
    alamatLengkap: 'Jl. Supriyadi No. 12, Manding',
    kelurahanDesa: 'Trirenggo',
    kecamatan: 'Bantul',
    kabupatenKota: 'Kab. Bantul',
    provinsi: 'D.I. Yogyakarta',
    kodePos: '55714',
    telepon: '(0274) 367123',
    email: 'mtsn2bantul@kemenag.go.id',
    website: 'https://mtsn2bantul.sch.id',
    logoUrl: '',
    namaKepala: 'Musa Surahman, S.Ag.',
    nipKepala: '197103141997031003',
    kotaTandaTangan: 'Bantul',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
];

export const SEED_MEMBERSHIPS: InstitutionMembership[] = [
  // Pandu at MAN 1 GK (Teacher)
  {
    id: 'mem_pandu_man1gk',
    userId: 'usr_pandu_001',
    institutionId: 'inst_man1gk',
    role: 'TEACHER',
    status: 'ACTIVE',
    joinedAt: '2024-01-10T08:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  // Pandu also has admin role at MTsN 2 Bantul (Testing multi-institution & elevated roles)
  {
    id: 'mem_pandu_mtsn2btl',
    userId: 'usr_pandu_001',
    institutionId: 'inst_mtsn2btl',
    role: 'SCHOOL_ADMIN',
    status: 'ACTIVE',
    joinedAt: '2024-03-01T08:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  // Kholis at MAN 1 GK (Headmaster)
  {
    id: 'mem_kholis_man1gk',
    userId: 'usr_kholis_002',
    institutionId: 'inst_man1gk',
    role: 'HEADMASTER',
    status: 'ACTIVE',
    joinedAt: '2024-01-10T08:00:00.000Z',
    updatedAt: new Date().toISOString(),
  },
  // Siti at MTsN 2 Bantul (Teacher)
  {
    id: 'mem_siti_mtsn2btl',
    userId: 'usr_siti_003',
    institutionId: 'inst_mtsn2btl',
    role: 'TEACHER',
    status: 'ACTIVE',
    joinedAt: '2024-02-15T09:30:00.000Z',
    updatedAt: new Date().toISOString(),
  },
];

// Helper to format full teacher name with titles
export function formatFullTeacherName(user: UserProfile): string {
  const front = user.gelarDepan?.trim() ? `${user.gelarDepan.trim()} ` : '';
  const back = user.gelarBelakang?.trim() ? `, ${user.gelarBelakang.trim()}` : '';
  return `${front}${user.namaLengkap.trim()}${back}`;
}

// 2. Storage abstraction methods
export function getAllUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (!raw) {
      saveAllUsers(SEED_USERS);
      return SEED_USERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_USERS;
  } catch (e) {
    console.error('Failed reading users from localStorage:', e);
    return SEED_USERS;
  }
}

export function saveAllUsers(users: UserProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  } catch (e) {
    console.error('Failed saving users to localStorage:', e);
  }
}

export function getCurrentUserId(): string {
  try {
    const id = localStorage.getItem(STORAGE_KEY_CURRENT_USER_ID);
    if (id) return id;
    const defaultId = SEED_USERS[0].id;
    setCurrentUserId(defaultId);
    return defaultId;
  } catch {
    return SEED_USERS[0].id;
  }
}

export function setCurrentUserId(userId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_CURRENT_USER_ID, userId);
  } catch (e) {
    console.error('Failed setting current user id:', e);
  }
}

export function getCurrentUser(): UserProfile {
  const currentId = getCurrentUserId();
  const allUsers = getAllUsers();
  const match = allUsers.find((u) => u.id === currentId);
  return match || allUsers[0] || SEED_USERS[0];
}

export function saveCurrentUser(updatedUser: UserProfile): void {
  const allUsers = getAllUsers();
  const index = allUsers.findIndex((u) => u.id === updatedUser.id);
  const formattedName = formatFullTeacherName(updatedUser);

  const syncedUser: UserProfile = {
    ...updatedUser,
    namaGuru: formattedName,
    nipGuru: updatedUser.nip,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    allUsers[index] = syncedUser;
  } else {
    allUsers.push(syncedUser);
  }

  saveAllUsers(allUsers);
}

export function getAllInstitutions(): InstitutionProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INSTITUTIONS);
    if (!raw) {
      saveAllInstitutions(SEED_INSTITUTIONS);
      return SEED_INSTITUTIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_INSTITUTIONS;
  } catch (e) {
    console.error('Failed reading institutions from localStorage:', e);
    return SEED_INSTITUTIONS;
  }
}

export function saveAllInstitutions(institutions: InstitutionProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_INSTITUTIONS, JSON.stringify(institutions));
  } catch (e) {
    console.error('Failed saving institutions to localStorage:', e);
  }
}

export function getInstitutionById(id: string): InstitutionProfile | undefined {
  const all = getAllInstitutions();
  return all.find((inst) => inst.id === id);
}

export function getAllMemberships(): InstitutionMembership[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEMBERSHIPS);
    if (!raw) {
      saveAllMemberships(SEED_MEMBERSHIPS);
      return SEED_MEMBERSHIPS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_MEMBERSHIPS;
  } catch (e) {
    console.error('Failed reading memberships from localStorage:', e);
    return SEED_MEMBERSHIPS;
  }
}

export function saveAllMemberships(memberships: InstitutionMembership[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_MEMBERSHIPS, JSON.stringify(memberships));
  } catch (e) {
    console.error('Failed saving memberships to localStorage:', e);
  }
}

export function getUserMemberships(userId: string): InstitutionMembership[] {
  const all = getAllMemberships();
  return all.filter((m) => m.userId === userId && m.status === 'ACTIVE');
}

export function getActiveInstitutionId(): string {
  try {
    const currentUserId = getCurrentUserId();
    const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_INSTITUTION_ID);
    const userMemberships = getUserMemberships(currentUserId);

    if (stored && userMemberships.some((m) => m.institutionId === stored)) {
      return stored;
    }

    const firstInstitutionId = userMemberships[0]?.institutionId || SEED_INSTITUTIONS[0].id;
    setActiveInstitutionId(firstInstitutionId);
    return firstInstitutionId;
  } catch {
    return SEED_INSTITUTIONS[0].id;
  }
}

export function setActiveInstitutionId(institutionId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_INSTITUTION_ID, institutionId);
  } catch (e) {
    console.error('Failed setting active institution id:', e);
  }
}

// Role Authorization Check
export function canEditInstitution(role: InstitutionRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN' || role === 'HEADMASTER';
}

// Save Institution with Role Permission Enforcement
export function saveInstitutionProfile(
  institution: InstitutionProfile,
  callerRole: InstitutionRole
): { success: boolean; error?: string } {
  if (!canEditInstitution(callerRole)) {
    return {
      success: false,
      error: 'Akses ditolak: Hanya Admin Sekolah, Super Admin, atau Kepala Madrasah yang berhak mengubah profil institusi.',
    };
  }

  const allInstitutions = getAllInstitutions();
  const index = allInstitutions.findIndex((i) => i.id === institution.id);
  const updatedInstitution = {
    ...institution,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    allInstitutions[index] = updatedInstitution;
  } else {
    allInstitutions.push(updatedInstitution);
  }

  saveAllInstitutions(allInstitutions);
  return { success: true };
}

// Complete Tenant Context
export function getTenantContext(): TenantContext {
  const currentUser = getCurrentUser();
  const activeInstitutionId = getActiveInstitutionId();
  const userMemberships = getUserMemberships(currentUser.id);

  let currentMembership = userMemberships.find((m) => m.institutionId === activeInstitutionId);
  if (!currentMembership) {
    currentMembership = userMemberships[0] || {
      id: `mem_auto_${currentUser.id}`,
      userId: currentUser.id,
      institutionId: activeInstitutionId,
      role: 'TEACHER',
      status: 'ACTIVE',
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const currentInstitution =
    getInstitutionById(currentMembership.institutionId) || SEED_INSTITUTIONS[0];

  const userInstitutions = userMemberships
    .map((mem) => {
      const inst = getInstitutionById(mem.institutionId);
      if (!inst) return null;
      return {
        institution: inst,
        membership: mem,
      };
    })
    .filter(Boolean) as Array<{ institution: InstitutionProfile; membership: InstitutionMembership }>;

  return {
    currentUser,
    currentMembership,
    currentInstitution,
    userInstitutions,
  };
}

// Switch active institution
export function switchActiveInstitution(institutionId: string): TenantContext {
  setActiveInstitutionId(institutionId);
  return getTenantContext();
}

// Switch active user (for multi-user simulation & testing tenant isolation)
export function switchActiveUser(userId: string): TenantContext {
  setCurrentUserId(userId);
  const userMemberships = getUserMemberships(userId);
  if (userMemberships.length > 0) {
    setActiveInstitutionId(userMemberships[0].institutionId);
  }
  return getTenantContext();
}

// Sync Master Input with Tenant (User Profile + Institution Profile)
export function syncMasterInputWithTenant(
  currentInput: MasterInputData,
  user: UserProfile,
  institution: InstitutionProfile
): MasterInputData {
  const formattedTeacherName = formatFullTeacherName(user);

  return {
    ...currentInput,
    // School identity from Institution Profile
    kemenagOrYayasan: institution.kementerianDinas || currentInput.kemenagOrYayasan,
    namaMadrasah: institution.namaResmi || institution.namaSingkat || currentInput.namaMadrasah,
    alamatMadrasah: institution.alamatLengkap
      ? `${institution.alamatLengkap}, ${institution.kelurahanDesa}, ${institution.kecamatan}, ${institution.kabupatenKota}`
      : currentInput.alamatMadrasah,
    namaKepala: institution.namaKepala || currentInput.namaKepala,
    nipKepala: institution.nipKepala || currentInput.nipKepala,
    kotaTandaTangan: institution.kotaTandaTangan || currentInput.kotaTandaTangan,

    // Teacher identity from User Profile
    namaGuru: formattedTeacherName || currentInput.namaGuru,
    nipGuru: user.nip || currentInput.nipGuru,
    mataPelajaran: user.preferensiMataPelajaran || currentInput.mataPelajaran,
  };
}
