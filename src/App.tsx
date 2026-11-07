import React, { useState, useEffect } from 'react';
import {
  Project,
  DocumentType,
  MasterInputData,
  AnyDocumentContent,
  UserProfile,
  InstitutionProfile,
  TenantContext,
  InstitutionRole,
} from './types';
import {
  getAllProjects,
  getCurrentProject,
  saveProject,
  setCurrentProjectId,
  createNewProject,
  duplicateProject,
  deleteProject,
  exportProjectToJson,
} from './services/storageService';
import {
  DEMO_MASTER_INPUT,
  EMPTY_MASTER_INPUT,
  createEmptyDocumentRecord,
} from './services/defaultData';
import {
  getTenantContext,
  saveCurrentUser,
  saveInstitutionProfile,
  switchActiveInstitution,
  switchActiveUser,
  getAllUsers,
  syncMasterInputWithTenant,
} from './services/tenantService';
import {
  getCurrentSession,
  logout as apiLogout,
  logoutAll as apiLogoutAll,
  AuthUser,
} from './services/authClient';
import { Navbar, AppTabType } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { MasterInputView } from './components/MasterInputView';
import { AIToolsView } from './components/AIToolsView';
import { HistoryAndBackupView } from './components/HistoryAndBackupView';
import { UserProfileView } from './components/UserProfileView';
import { InstitutionProfileView } from './components/InstitutionProfileView';
import { InstitutionMembershipView } from './components/InstitutionMembershipView';
import { PlatformAdminConsole } from './components/PlatformAdminConsole';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const [allProjects, setAllProjects] = useState<Project[]>(() => getAllProjects());
  const [currentProject, setCurrentProject] = useState<Project>(() => getCurrentProject());
  const [activeTab, setActiveTab] = useState<AppTabType>('dashboard');
  const [selectedDoc, setSelectedDoc] = useState<DocumentType>('ACP');
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [tenantContext, setTenantContext] = useState<TenantContext>(() => getTenantContext());
  const [availableUsers, setAvailableUsers] = useState(() => getAllUsers());

  // Authentication State (Phase 3B)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  // Restore authenticated session from backend cookie on mount
  useEffect(() => {
    let isMounted = true;
    getCurrentSession()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.user) {
          setIsAuthenticated(true);
          if (res.tenantContext) {
            setTenantContext(res.tenantContext as any);
          }
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsAuthenticated(false);
      })
      .finally(() => {
        if (isMounted) setAuthLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync to storage whenever currentProject changes and is marked saved
  useEffect(() => {
    saveProject(currentProject);
  }, [currentProject]);


  const handleMasterInputChange = (updated: MasterInputData) => {
    setIsSaved(false);
    setCurrentProject((prev) => ({
      ...prev,
      masterInput: updated,
    }));
  };

  const handleSaveMasterInput = () => {
    saveProject(currentProject);
    setIsSaved(true);
    setAllProjects(getAllProjects());
  };

  const handleSaveUserProfile = (profile: UserProfile) => {
    saveCurrentUser(profile);
    const updatedCtx = getTenantContext();
    setTenantContext(updatedCtx);
    setAvailableUsers(getAllUsers());
  };

  const handleSaveInstitutionProfile = (
    institution: InstitutionProfile,
    callerRole: InstitutionRole
  ) => {
    const res = saveInstitutionProfile(institution, callerRole);
    if (res.success) {
      const updatedCtx = getTenantContext();
      setTenantContext(updatedCtx);
    }
    return res;
  };

  const handleSwitchActiveInstitution = (institutionId: string) => {
    const updatedCtx = switchActiveInstitution(institutionId);
    setTenantContext(updatedCtx);
  };

  const handleSwitchActiveUser = (userId: string) => {
    const updatedCtx = switchActiveUser(userId);
    setTenantContext(updatedCtx);
  };

  const handleSyncMasterInputWithTenant = () => {
    const synced = syncMasterInputWithTenant(
      currentProject.masterInput,
      tenantContext.currentUser,
      tenantContext.currentInstitution
    );
    setIsSaved(false);
    setCurrentProject((prev) => ({
      ...prev,
      masterInput: synced,
    }));
  };

  const handleApplyUserProfile = () => {
    handleSyncMasterInputWithTenant();
  };

  const handleFillExample = () => {
    setIsSaved(false);
    setCurrentProject((prev) => ({
      ...prev,
      masterInput: JSON.parse(JSON.stringify(DEMO_MASTER_INPUT)),
    }));
  };

  const handleResetForm = () => {
    if (confirm('Yakin ingin mereset formulir Master Input? Data identitas dan kurikulum akan dikosongkan.')) {
      setIsSaved(false);
      setCurrentProject((prev) => ({
        ...prev,
        masterInput: JSON.parse(JSON.stringify(EMPTY_MASTER_INPUT)),
      }));
    }
  };

  const handleUpdateDocument = (
    docType: DocumentType,
    content: AnyDocumentContent,
    changelog = 'Dokumen diperbarui'
  ) => {
    setCurrentProject((prev) => {
      const prevDoc = prev.documents[docType];
      const updatedDoc = {
        ...prevDoc,
        version: prevDoc.content ? prevDoc.version + 1 : 1,
        status: 'completed' as const,
        updatedAt: new Date().toISOString(),
        content,
        changelog,
      };

      const nextDocs = {
        ...prev.documents,
        [docType]: updatedDoc,
      };

      const updatedProj: Project = {
        ...prev,
        documents: nextDocs,
        updatedAt: new Date().toISOString(),
      };

      saveProject(updatedProj);
      return updatedProj;
    });

    setAllProjects(getAllProjects());
    setIsSaved(true);
  };

  const handleMarkNeedsRevision = (affectedTypes: DocumentType[]) => {
    setCurrentProject((prev) => {
      let changed = false;
      const nextDocs = { ...prev.documents };

      affectedTypes.forEach((type) => {
        if (nextDocs[type].status === 'completed') {
          nextDocs[type] = {
            ...nextDocs[type],
            status: 'needs_revision',
            updatedAt: new Date().toISOString(),
            changelog: 'Memerlukan penyesuaian karena dokumen hulu diperbarui.',
          };
          changed = true;
        }
      });

      if (!changed) return prev;

      const updatedProj = { ...prev, documents: nextDocs };
      saveProject(updatedProj);
      return updatedProj;
    });
  };

  const handleNewProject = () => {
    const proj = createNewProject(undefined, tenantContext.currentUser);
    const syncedMaster = syncMasterInputWithTenant(
      proj.masterInput,
      tenantContext.currentUser,
      tenantContext.currentInstitution
    );
    const institutionName =
      tenantContext.currentInstitution.namaSingkat || tenantContext.currentInstitution.namaResmi;
    const subjectName = tenantContext.currentUser.preferensiMataPelajaran || 'Mapel';
    proj.name = `Administrasi ${subjectName} - ${institutionName}`;
    proj.masterInput = syncedMaster;

    saveProject(proj);
    setAllProjects(getAllProjects());
    setCurrentProject(proj);
    setIsSaved(true);
    setActiveTab('master_input');
  };

  const handleDuplicateProject = () => {
    const duplicated = duplicateProject(currentProject);
    setAllProjects(getAllProjects());
    setCurrentProject(duplicated);
    setIsSaved(true);
    alert(`Proyek berhasil diduplikasi menjadi: "${duplicated.name}"`);
  };

  const handleSwitchProject = (id: string) => {
    setCurrentProjectId(id);
    const match = allProjects.find((p) => p.id === id);
    if (match) {
      setCurrentProject(match);
      setIsSaved(true);
    }
  };

  const handleDeleteProject = (id: string) => {
    const updated = deleteProject(id);
    setAllProjects(updated);
    setCurrentProject(updated[0]);
    setIsSaved(true);
  };

  const handleImportProject = (imported: Project) => {
    saveProject(imported);
    setCurrentProjectId(imported.id);
    setAllProjects(getAllProjects());
    setCurrentProject(imported);
    setIsSaved(true);
  };

  const handleLoginSuccess = async (_user: AuthUser) => {
    setIsAuthenticated(true);
    try {
      const res = await getCurrentSession();
      if (res.success && res.tenantContext) {
        setTenantContext(res.tenantContext as any);
      }
    } catch {
      // fallback
    }
  };

  const handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
      await apiLogout();
      setIsAuthenticated(false);
    }
  };

  const handleLogoutAll = async () => {
    if (confirm('Yakin ingin mencabut seluruh sesi di semua perangkat?')) {
      const res = await apiLogoutAll();
      alert(res.message || 'Seluruh sesi berhasil dicabut.');
      setIsAuthenticated(false);
    }
  };

  return (
    <Navbar
      currentProject={currentProject}
      allProjects={allProjects}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onSwitchProject={handleSwitchProject}
      onNewProject={handleNewProject}
      isSaved={isSaved}
      onExportJson={() => exportProjectToJson(currentProject)}
      tenantContext={tenantContext}
      isAuthenticated={isAuthenticated}
      onOpenAuthModal={() => setAuthModalOpen(true)}
      onLogout={handleLogout}
    >
      {/* Main Content View Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6 pb-12">
        {activeTab === 'dashboard' && (
          <DashboardView
            project={currentProject}
            onNavigateTab={setActiveTab}
            onSelectDocument={(doc) => {
              setSelectedDoc(doc);
              setActiveTab('ai_tools');
            }}
          />
        )}

        {activeTab === 'master_input' && (
          <MasterInputView
            data={currentProject.masterInput}
            onChange={handleMasterInputChange}
            onSave={handleSaveMasterInput}
            onReset={handleResetForm}
            onDuplicateProject={handleDuplicateProject}
            onFillExample={handleFillExample}
            isSaved={isSaved}
            userProfile={tenantContext.currentUser}
            onSaveUserProfile={handleSaveUserProfile}
            onApplyUserProfile={handleApplyUserProfile}
            tenantContext={tenantContext}
            onSyncTenantContext={handleSyncMasterInputWithTenant}
          />
        )}

        {activeTab === 'ai_tools' && (
          <AIToolsView
            project={currentProject}
            selectedDoc={selectedDoc}
            onSelectDoc={setSelectedDoc}
            onUpdateDocument={handleUpdateDocument}
            onMarkNeedsRevision={handleMarkNeedsRevision}
            onProjectUpdate={(updatedProj) => {
              setCurrentProject(updatedProj);
              setAllProjects(getAllProjects());
            }}
            activeInstitutionId={tenantContext.currentInstitution?.id}
          />
        )}

        {activeTab === 'history' && (
          <HistoryAndBackupView
            currentProject={currentProject}
            allProjects={allProjects}
            onSwitchProject={handleSwitchProject}
            onNewProject={handleNewProject}
            onDuplicateProject={handleDuplicateProject}
            onDeleteProject={handleDeleteProject}
            onImportProject={handleImportProject}
          />
        )}

        {activeTab === 'user_profile' && (
          <UserProfileView
            tenantContext={tenantContext}
            onSaveUserProfile={handleSaveUserProfile}
            onApplyToMasterInput={handleSyncMasterInputWithTenant}
            onLogout={handleLogout}
            onLogoutAll={handleLogoutAll}
          />
        )}

        {activeTab === 'institution_profile' && (
          <InstitutionProfileView
            tenantContext={tenantContext}
            onSaveInstitutionProfile={handleSaveInstitutionProfile}
            onApplyToMasterInput={handleSyncMasterInputWithTenant}
          />
        )}

        {activeTab === 'membership' && (
          <InstitutionMembershipView
            tenantContext={tenantContext}
            onSwitchActiveInstitution={handleSwitchActiveInstitution}
            onSwitchActiveUser={handleSwitchActiveUser}
            availableUsers={availableUsers}
          />
        )}

        {activeTab === 'platform_admin' && (
          <PlatformAdminConsole />
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </Navbar>
  );
}

