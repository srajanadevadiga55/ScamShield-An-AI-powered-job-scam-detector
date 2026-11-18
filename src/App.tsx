/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { User } from './types';
import { apiRequest, setStoredToken } from './lib/api';
import { LandingPage } from './components/LandingPage';
import { DashboardWorkspace } from './components/DashboardWorkspace';
import { AuthModal } from './components/AuthModal';
import { AssistantDrawer } from './components/AssistantDrawer';
import { PolicyModal } from './components/PolicyModal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [view, setView] = useState<'landing' | 'dashboard'>('landing');
  const [dashboardTab, setDashboardTab] = useState<string>('overview');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantContext, setAssistantContext] = useState<string | undefined>(undefined);
  const [policyDoc, setPolicyDoc] = useState<'privacy' | 'disclaimer' | 'terms' | null>(null);

  useEffect(() => {
    apiRequest<{ user: User | null }>('/api/auth/me')
      .then((res) => {
        if (res.user) {
          setUser(res.user);
        }
      })
      .catch(() => {
        setStoredToken(null);
      })
      .finally(() => {
        setBootstrapping(false);
      });
  }, []);

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-[#070C18] flex items-center justify-center text-slate-300 gap-2.5 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span>Loading ScamShield...</span>
      </div>
    );
  }

  return (
    <>
      {view === 'dashboard' && user ? (
        <DashboardWorkspace
          user={user}
          initialTab={dashboardTab}
          onUserUpdated={(updated) => setUser(updated)}
          onSignedOut={() => {
            setUser(null);
            setView('landing');
          }}
          onBackToLanding={() => setView('landing')}
          onOpenAssistant={(ctx) => {
            setAssistantContext(ctx);
            setAssistantOpen(true);
          }}
        />
      ) : (
        <LandingPage
          user={user}
          onOpenAuth={(mode) => {
            setAuthMode(mode);
            setAuthModalOpen(true);
          }}
          onEnterDashboard={(tab = 'overview') => {
            if (!user) {
              setAuthMode('login');
              setAuthModalOpen(true);
              return;
            }
            setDashboardTab(tab);
            setView('dashboard');
          }}
          onSignOut={async () => {
            await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
            setStoredToken(null);
            setUser(null);
          }}
          onOpenAssistant={(ctx) => {
            setAssistantContext(ctx);
            setAssistantOpen(true);
          }}
          onOpenPolicy={(doc) => setPolicyDoc(doc)}
        />
      )}

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(authenticatedUser) => {
          setUser(authenticatedUser);
          setDashboardTab('overview');
          setView('dashboard');
        }}
      />

      <AssistantDrawer
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        initialContext={assistantContext}
      />

      <PolicyModal activeDoc={policyDoc} onClose={() => setPolicyDoc(null)} />
    </>
  );
}
