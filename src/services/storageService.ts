import { Project, UserProfile } from '../types';
import { createInitialProject, INITIAL_DEVICE_USER_PROFILE } from './defaultData';

export const STORAGE_KEY_PROJECTS = 'kbc_administrasi_projects_v1';
export const STORAGE_KEY_CURRENT_ID = 'kbc_administrasi_current_id_v1';
export const STORAGE_KEY_USER_PROFILE = 'kbc_user_profile_v1';

export function getUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER_PROFILE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading user profile from localStorage:', e);
    return null;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY_USER_PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed saving user profile to localStorage:', e);
  }
}

export function getOrCreateDeviceUserProfile(): UserProfile {
  const existing = getUserProfile();
  if (existing) return existing;
  // Initialize device profile on first run on this device
  saveUserProfile(INITIAL_DEVICE_USER_PROFILE);
  return INITIAL_DEVICE_USER_PROFILE;
}

export function getAllProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (!raw) {
      const profile = getOrCreateDeviceUserProfile();
      const initial = createInitialProject(profile);
      saveAllProjects([initial]);
      return [initial];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const profile = getOrCreateDeviceUserProfile();
      const initial = createInitialProject(profile);
      saveAllProjects([initial]);
      return [initial];
    }
    return parsed;
  } catch (e) {
    console.error('Failed reading projects from localStorage:', e);
    const profile = getOrCreateDeviceUserProfile();
    const initial = createInitialProject(profile);
    return [initial];
  }
}

export function saveAllProjects(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed saving projects to localStorage:', e);
  }
}

export function getCurrentProjectId(): string {
  try {
    const id = localStorage.getItem(STORAGE_KEY_CURRENT_ID);
    if (id) return id;
    const all = getAllProjects();
    const firstId = all[0]?.id || 'proj-default';
    setCurrentProjectId(firstId);
    return firstId;
  } catch {
    return 'proj-default';
  }
}

export function setCurrentProjectId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_CURRENT_ID, id);
  } catch (e) {
    console.error('Failed setting current project id:', e);
  }
}

export function getCurrentProject(): Project {
  const currentId = getCurrentProjectId();
  const all = getAllProjects();
  const match = all.find((p) => p.id === currentId);
  if (match) return match;
  return all[0] || createInitialProject();
}

export function saveProject(project: Project): void {
  const all = getAllProjects();
  const index = all.findIndex((p) => p.id === project.id);
  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    all[index] = updatedProject;
  } else {
    all.unshift(updatedProject);
  }

  saveAllProjects(all);
}

export function createNewProject(name?: string, customProfile?: UserProfile | null): Project {
  const profile = customProfile !== undefined ? customProfile : (getUserProfile() || getOrCreateDeviceUserProfile());
  const newProject = createInitialProject(profile);
  if (name) {
    newProject.name = name;
  }

  const all = getAllProjects();
  all.unshift(newProject);
  saveAllProjects(all);
  setCurrentProjectId(newProject.id);
  return newProject;
}

export function duplicateProject(sourceProject: Project): Project {
  const duplicated: Project = {
    ...JSON.parse(JSON.stringify(sourceProject)),
    id: `proj-copy-${Date.now()}`,
    name: `${sourceProject.name} (Salinan)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const all = getAllProjects();
  all.unshift(duplicated);
  saveAllProjects(all);
  setCurrentProjectId(duplicated.id);
  return duplicated;
}

export function deleteProject(id: string): Project[] {
  let all = getAllProjects();
  if (all.length <= 1) {
    // Keep at least one project
    all = [createInitialProject()];
    saveAllProjects(all);
    setCurrentProjectId(all[0].id);
    return all;
  }

  all = all.filter((p) => p.id !== id);
  saveAllProjects(all);
  setCurrentProjectId(all[0].id);
  return all;
}

export function exportProjectToJson(project: Project): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  const cleanName = project.name.replace(/[^a-zA-Z0-9]/g, '_');
  downloadAnchor.setAttribute('download', `BACKUP_${cleanName}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
