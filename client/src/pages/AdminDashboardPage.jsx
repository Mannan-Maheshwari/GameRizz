import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, CheckCircle, AlertTriangle, FileText, Lock, LogOut, ArrowLeft, RefreshCw, Undo2 } from 'lucide-react';

export default function AdminDashboardPage({ onReturnToLobby }) {
  const [token, setToken] = useState(() => localStorage.getItem('gamerizz_admin_token') || '');
  const [adminUser, setAdminUser] = useState(null);

  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState('tickets'); // 'tickets' | 'enforcements' | 'audit'
  const [tickets, setTickets] = useState([]);
  const [enforcements, setEnforcements] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Selected ticket for action modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [enforcementType, setEnforcementType] = useState('temporary_ban');

  // Check existing session
  useEffect(() => {
    if (token) {
      fetchAdminSession();
    }
  }, [token]);

  const fetchAdminSession = async () => {
    try {
      const res = await fetch('/api/admin/session', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAdminUser(data.data.admin);
        loadDashboardData();
      } else {
        handleLogout();
      }
    } catch {
      handleLogout();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        const t = data.data.token;
        setToken(t);
        localStorage.setItem('gamerizz_admin_token', t);
        setAdminUser(data.data.admin);
        loadDashboardData(t);
      } else {
        setLoginError(data.error?.message || 'Login failed. Invalid credentials.');
      }
    } catch {
      setLoginError('Unable to connect to server.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gamerizz_admin_token');
    setToken('');
    setAdminUser(null);
  };

  const loadDashboardData = async (currentToken = token) => {
    setIsLoadingData(true);
    try {
      const headers = { Authorization: `Bearer ${currentToken}` };

      // Load tickets
      const q = new URLSearchParams();
      if (statusFilter) q.append('status', statusFilter);
      if (categoryFilter) q.append('category', categoryFilter);

      const [ticketsRes, auditRes] = await Promise.all([
        fetch(`/api/admin/reports?${q.toString()}`, { headers }),
        fetch('/api/admin/audit-logs', { headers })
      ]);

      const ticketsData = await ticketsRes.json();
      const auditData = await auditRes.json();

      if (ticketsData.success) setTickets(ticketsData.data.tickets || []);
      if (auditData.success) setAuditLogs(auditData.data.auditLogs || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId, status, decision, reason) => {
    try {
      const res = await fetch(`/api/admin/reports/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          decision,
          decisionReason: reason
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTicket(null);
        setDecisionReason('');
        loadDashboardData();
      }
    } catch (err) {
      alert('Failed to update ticket: ' + err.message);
    }
  };

  const handleIssueBan = async () => {
    if (!selectedTicket) return;
    try {
      const res = await fetch('/api/admin/enforcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetSessionId: selectedTicket.reportedSessionId,
          type: enforcementType,
          reason: decisionReason || selectedTicket.category,
          durationHours: enforcementType === 'temporary_ban' ? 48 : null
        })
      });
      const data = await res.json();
      if (data.success) {
        await handleUpdateTicketStatus(selectedTicket.ticketId, 'action_taken', enforcementType, decisionReason);
      }
    } catch (err) {
      alert('Failed to issue ban: ' + err.message);
    }
  };

  // If not logged in, render login view (FR-081, FR-082)
  if (!adminUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mx-auto mb-4">
            <Lock size={24} />
          </div>
          <h2 className="text-xl font-black text-center text-white mb-1">Gamerizz Admin</h2>
          <p className="text-xs text-center text-slate-400 mb-6">Restricted moderation & safety access</p>

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Shield size={14} />
              <span>{isLoggingIn ? 'Verifying...' : 'Sign In to Dashboard'}</span>
            </button>
          </form>

          <button
            onClick={onReturnToLobby}
            className="w-full mt-4 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-1.5"
          >
            <ArrowLeft size={13} />
            <span>Return to Gamerizz</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Top Navigation */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/80 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Shield size={18} />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-wide">GAMERIZZ MODERATION</h1>
            <span className="text-[10px] text-emerald-400 font-mono">Operator: {adminUser.username}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadDashboardData()}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoadingData ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onReturnToLobby}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5"
          >
            <ArrowLeft size={14} />
            <span>Back to App</span>
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs"
            title="Log Out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-5">
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${activeTab === 'tickets' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <ShieldAlert size={14} />
            <span>Reports & Tickets ({tickets.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${activeTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <FileText size={14} />
            <span>Audit Trail ({auditLogs.length})</span>
          </button>
        </div>

        {/* --- TICKETS TAB --- */}
        {activeTab === 'tickets' && (
          <div className="flex flex-col gap-4">
            {/* Filter Controls */}
            <div className="flex flex-wrap gap-3 items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">Filter by:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="under_review">Under Review</option>
                <option value="action_taken">Action Taken</option>
                <option value="no_violation_found">No Violation</option>
                <option value="resolved">Resolved</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                <option value="">All Categories</option>
                <option value="harassment">Harassment</option>
                <option value="sexual_content">Sexual Content</option>
                <option value="hate_speech">Hate Speech</option>
                <option value="spam">Spam</option>
                <option value="threats">Threats</option>
                <option value="other">Other</option>
              </select>

              <button
                onClick={() => loadDashboardData()}
                className="ml-auto px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Apply Filter
              </button>
            </div>

            {/* Tickets Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    <th className="p-3">Ticket ID</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Reporter</th>
                    <th className="p-3">Reported</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        No moderation tickets match the filter.
                      </td>
                    </tr>
                  ) : (
                    tickets.map((t) => (
                      <tr key={t.ticketId} className="hover:bg-slate-850/40 transition-colors">
                        <td className="p-3 font-mono text-slate-300 text-[11px]">{t.ticketId.substring(0, 15)}...</td>
                        <td className="p-3">
                          <span className="capitalize px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">
                            {t.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{t.reporterNickname}</td>
                        <td className="p-3 font-semibold text-rose-300">{t.reportedNickname}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${t.status === 'open' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : t.status === 'under_review' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : t.status === 'action_taken' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedTicket(t)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-semibold transition-all"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- AUDIT TRAIL TAB (FR-089) --- */}
        {activeTab === 'audit' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Admin</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      No administrative actions recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.auditId}>
                      <td className="p-3 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-3 text-indigo-400 font-semibold">{log.adminUsername}</td>
                      <td className="p-3 text-white font-bold">{log.action}</td>
                      <td className="p-3 text-slate-300">{log.targetId}</td>
                      <td className="p-3 text-slate-400 font-sans">{log.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- REVIEW TICKET MODAL --- */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <ShieldAlert className="text-rose-400" size={18} />
              <span>Review Ticket: {selectedTicket.ticketId.substring(0, 16)}</span>
            </h3>

            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 mb-4 text-xs space-y-1.5">
              <div><strong className="text-slate-400">Category:</strong> <span className="text-white capitalize">{selectedTicket.category.replace('_', ' ')}</span></div>
              <div><strong className="text-slate-400">Reporter:</strong> <span className="text-slate-300">{selectedTicket.reporterNickname}</span></div>
              <div><strong className="text-slate-400">Reported Stranger:</strong> <span className="text-rose-400 font-semibold">{selectedTicket.reportedNickname}</span></div>
              <div><strong className="text-slate-400">Match ID:</strong> <span className="text-slate-500 font-mono text-[10px]">{selectedTicket.matchId}</span></div>
              {selectedTicket.reporterNote && (
                <div className="mt-2 pt-2 border-t border-slate-800">
                  <strong className="text-slate-400 block mb-0.5">Reporter Note:</strong>
                  <p className="text-slate-300 italic">{selectedTicket.reporterNote}</p>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Moderator Decision Note / Reason:
              </label>
              <textarea
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="Reason for enforcement action or resolution..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Decision Actions */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateTicketStatus(selectedTicket.ticketId, 'under_review', 'investigating', decisionReason)}
                  className="flex-1 py-2 rounded-xl bg-cyan-600/30 hover:bg-cyan-600 text-cyan-200 border border-cyan-500/40 text-xs font-semibold"
                >
                  Mark Under Review
                </button>
                <button
                  onClick={() => handleUpdateTicketStatus(selectedTicket.ticketId, 'no_violation_found', 'dismissed', decisionReason)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  No Violation Found
                </button>
              </div>

              <div className="flex gap-2 mt-1">
                <select
                  value={enforcementType}
                  onChange={(e) => setEnforcementType(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-rose-300"
                >
                  <option value="temporary_ban">48h Temporary Ban</option>
                  <option value="permanent_ban">Permanent Ban</option>
                </select>
                <button
                  onClick={handleIssueBan}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
                >
                  Enforce Ban & Close Ticket
                </button>
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                className="mt-2 py-1.5 text-xs text-slate-500 hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
