'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Users, Search, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck,
  UserCheck, ExternalLink, Filter, MapPin, Mail, Phone, Calendar, Hash, Eye, X,
  Upload, Download, Trash2, FileSpreadsheet, Loader2
} from 'lucide-react';

export default function VotersVerificationTab({ onSwitchToCases }) {
  const [voters, setVoters] = useState([]);
  const [stats, setStats] = useState({ totalVoters: 0, verifiedVoters: 0, openCases: 0, statesCount: 0 });
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const [q, setQ] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [inspectVoter, setInspectVoter] = useState(null);

  const loadVoters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (selectedState) params.set('state', selectedState);
      params.set('limit', '100');

      const res = await fetch(`/api/admin/voters?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load voters');

      setVoters(data.voters || []);
      setStats(data.stats || { totalVoters: 0, verifiedVoters: 0, openCases: 0, statesCount: 0 });
      setStates(data.states || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [q, selectedState]);

  useEffect(() => {
    loadVoters();
  }, [loadVoters]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv'], 'application/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    maxFiles: 1,
    onDropAccepted: async (files) => {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      setUploadMsg(null);
      const fd = new FormData();
      fd.append('file', file);
      try {
        const r = await fetch('/api/voters/upload-csv', { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Upload failed');
        const parts = [
          `${d.added} new ${d.added === 1 ? 'voter' : 'voters'} added`,
          d.unchanged ? `${d.unchanged} already on roll` : '',
          d.casesOpened ? `${d.casesOpened} cases flagged for review` : '',
        ].filter(Boolean);
        setUploadMsg({ type: 'success', text: parts.join(' · ') });
        loadVoters();
      } catch (err) {
        setUploadMsg({ type: 'error', text: err.message });
      } finally {
        setUploading(false);
      }
    },
  });

  const deleteVoter = async (voterId, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name} (${voterId}) from the Master Roll?`)) return;
    try {
      const res = await fetch(`/api/voters/roll?voterId=${encodeURIComponent(voterId)}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to remove voter');
      setUploadMsg({ type: 'success', text: `Voter ${name} (${voterId}) removed.` });
      loadVoters();
    } catch (err) {
      setUploadMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-ink">Electoral Roll & Voter Verification</h3>
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
              Live Master Roll
            </span>
          </div>
          <p className="text-xs text-body mt-1">
            Upload voter CSV rolls, verify registered voters, check constituency mapping, and manage roll integrity under Guardian authority.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/voters/template"
            download
            className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas hover:bg-surface-soft transition cursor-pointer"
          >
            <Download size={12} />
            <span>CSV Template</span>
          </a>
          <button
            type="button"
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-1.5 text-xs text-white font-semibold bg-primary hover:bg-primary/90 px-3.5 py-1.5 rounded-full transition shadow-sm cursor-pointer"
          >
            <Upload size={12} />
            <span>Upload Voter CSV</span>
          </button>
          <button
            type="button"
            onClick={loadVoters}
            className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas hover:bg-surface-soft transition cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-primary' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* CSV Upload Dropzone Panel */}
      {showUpload && (
        <div className="border border-dashed border-primary/30 bg-primary/5 rounded-2xl p-6 text-center space-y-3">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 cursor-pointer transition ${
              isDragActive ? 'border-primary bg-primary/10' : 'border-hairline hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <FileSpreadsheet size={32} className="text-primary mx-auto mb-2" />
            <p className="text-sm font-semibold text-ink">
              {uploading ? 'Uploading and validating voter roll…' : isDragActive ? 'Drop the voter CSV file here' : 'Drag & drop voter_roll_template.csv, or click to browse'}
            </p>
            <p className="text-xs text-muted mt-1">
              Supports columns: voterId, name, email, phone, gender, age, state, district, city, ward, assemblyConstituency, parliamentaryConstituency
            </p>
          </div>
        </div>
      )}

      {uploadMsg && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl text-xs border ${
            uploadMsg.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
              : 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300'
          }`}
        >
          <span>{uploadMsg.text}</span>
          <button type="button" onClick={() => setUploadMsg(null)} className="cursor-pointer font-bold">×</button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-soft border border-hairline rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-body">Total Enrolled</p>
            <Users size={15} className="text-primary" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1">{stats.totalVoters}</p>
          <p className="text-[11px] text-muted mt-0.5">Master roll database</p>
        </div>

        <div className="bg-surface-soft border border-hairline rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-body">Verified Clean</p>
            <ShieldCheck size={15} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.verifiedVoters}
          </p>
          <p className="text-[11px] text-muted mt-0.5">Ready for voting</p>
        </div>

        <div className="bg-surface-soft border border-hairline rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-body">Disputed Cases</p>
            <AlertTriangle size={15} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {stats.openCases}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            {stats.openCases > 0 && onSwitchToCases ? (
              <button
                type="button"
                onClick={onSwitchToCases}
                className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
              >
                Review in Voter Cases &rarr;
              </button>
            ) : (
              <p className="text-[11px] text-muted">Zero pending disputes</p>
            )}
          </div>
        </div>

        <div className="bg-surface-soft border border-hairline rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-body">States Covered</p>
            <MapPin size={15} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1">{stats.statesCount}</p>
          <p className="text-[11px] text-muted mt-0.5">{states.join(', ') || 'None'}</p>
        </div>
      </div>

      {/* Explainer Banner */}
      <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl p-3.5 flex items-start gap-3">
        <CheckCircle2 size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <span className="font-semibold">Voter Verification Architecture: </span>
          When voters are uploaded via CSV or created in the Commission Dashboard, clean rows with valid constituency codes are immediately added to the Master Electoral Roll shown below. If an uploaded row has duplicate IDs or missing fields, it is isolated in{' '}
          <button
            type="button"
            onClick={onSwitchToCases}
            className="underline font-semibold hover:text-blue-700 dark:hover:text-blue-100 cursor-pointer"
          >
            Voter cases
          </button>{' '}
          for guardian cryptographic arbitration.
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, Voter ID (EPIC), email..."
            className="w-full bg-canvas border border-hairline rounded-lg pl-9 pr-3 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
        </div>

        <div className="flex items-center gap-2">
          {states.length > 0 && (
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-canvas border border-hairline rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All States ({states.length})</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {(q || selectedState) && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setSelectedState('');
              }}
              className="text-xs text-muted hover:text-ink px-2 py-1.5 underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Voters Table */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 rounded-lg p-3 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted gap-2">
          <RefreshCw size={24} className="animate-spin text-primary" />
          <span className="text-xs">Loading master electoral roll...</span>
        </div>
      ) : voters.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-hairline rounded-xl bg-canvas">
          <Users size={36} className="text-muted mx-auto mb-3" />
          <p className="text-ink font-semibold">No voters found in Master Roll</p>
          <p className="text-body text-xs mt-1 max-w-md mx-auto">
            {q || selectedState
              ? 'No voters match your search criteria. Try clearing filters.'
              : 'The voter roll is currently empty. Upload the voter roll template CSV under Dashboard → Voters to populate verified voters.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-canvas">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-body font-medium">
                <th className="px-4 py-3">Voter ID (EPIC)</th>
                <th className="px-4 py-3">Full Name & Email</th>
                <th className="px-4 py-3">Age / Gender</th>
                <th className="px-4 py-3">Constituency Mapping</th>
                <th className="px-4 py-3">Location Details</th>
                <th className="px-4 py-3">Verification Status</th>
                <th className="px-4 py-3 text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {voters.map((v) => (
                <tr key={v._id} className="hover:bg-surface-soft/50 transition">
                  {/* Voter ID */}
                  <td className="px-4 py-3 font-mono font-semibold text-ink whitespace-nowrap">
                    <span className="inline-block bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[11px]">
                      {v.voterId}
                    </span>
                  </td>

                  {/* Name & Contact */}
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{v.name}</p>
                    <p className="text-muted text-[11px] flex items-center gap-1 mt-0.5">
                      <Mail size={11} className="shrink-0" />
                      {v.email}
                    </p>
                    {v.phone && (
                      <p className="text-muted text-[11px] flex items-center gap-1 mt-0.5">
                        <Phone size={11} className="shrink-0" />
                        {v.phone}
                      </p>
                    )}
                  </td>

                  {/* Age / Gender */}
                  <td className="px-4 py-3 whitespace-nowrap text-body">
                    {v.age ? `${v.age} yrs` : '—'}
                    {v.gender ? ` · ${v.gender}` : ''}
                  </td>

                  {/* Constituency */}
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {v.assemblyConstituency && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] uppercase font-bold text-muted">AC:</span>
                          <span className="font-mono text-[11px] bg-surface-soft border border-hairline px-1.5 py-0.2 rounded font-medium text-ink">
                            {v.assemblyConstituency}
                          </span>
                        </div>
                      )}
                      {v.parliamentaryConstituency && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] uppercase font-bold text-muted">PC:</span>
                          <span className="font-mono text-[11px] bg-surface-soft border border-hairline px-1.5 py-0.2 rounded font-medium text-ink">
                            {v.parliamentaryConstituency}
                          </span>
                        </div>
                      )}
                      {!v.assemblyConstituency && !v.parliamentaryConstituency && (
                        <span className="text-muted text-[11px]">No seats assigned</span>
                      )}
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-4 py-3 text-body">
                    <p className="font-medium text-ink">
                      {[v.city || v.village, v.district].filter(Boolean).join(', ') || '—'}
                    </p>
                    <p className="text-[11px] text-muted">
                      {[v.ward ? `Ward ${v.ward}` : '', v.state].filter(Boolean).join(' · ')}
                    </p>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {v.hasCase ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                        <AlertTriangle size={11} /> Case Open ({v.caseKind})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 size={11} /> Verified Master Roll
                      </span>
                    )}
                  </td>

                  {/* Audit / Inspect & Delete */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setInspectVoter(v)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 border border-primary/20 hover:border-primary/40 px-2.5 py-1 rounded-full bg-primary/5 transition cursor-pointer"
                      >
                        <Eye size={12} />
                        Verify
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteVoter(v.voterId, v.name)}
                        className="inline-flex items-center p-1 text-muted hover:text-red-600 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                        title={`Remove ${v.name} from roll`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inspect Modal */}
      {inspectVoter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-canvas border border-hairline rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-500" />
                <h4 className="font-semibold text-ink text-base">Voter Verification Record</h4>
              </div>
              <button
                type="button"
                onClick={() => setInspectVoter(null)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-surface-soft transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Voter Card Header */}
            <div className="bg-surface-soft border border-hairline rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">
                  {inspectVoter.voterId}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={12} /> Live Roll Enrolled
                </span>
              </div>
              <h3 className="text-lg font-bold text-ink">{inspectVoter.name}</h3>
              <p className="text-xs text-body flex items-center gap-1">
                <Mail size={12} className="text-muted" /> {inspectVoter.email}
              </p>
              {inspectVoter.phone && (
                <p className="text-xs text-body flex items-center gap-1">
                  <Phone size={12} className="text-muted" /> {inspectVoter.phone}
                </p>
              )}
            </div>

            {/* Demographic & Geographic Breakdown */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="border border-hairline rounded-lg p-3 bg-canvas space-y-1">
                <p className="text-[10px] font-bold text-muted uppercase">Demographics</p>
                <p className="text-ink font-medium">Age: {inspectVoter.age || '—'}</p>
                <p className="text-ink font-medium">Gender: {inspectVoter.gender || '—'}</p>
              </div>

              <div className="border border-hairline rounded-lg p-3 bg-canvas space-y-1">
                <p className="text-[10px] font-bold text-muted uppercase">Electoral Constituencies</p>
                <p className="text-ink font-medium">AC: {inspectVoter.assemblyConstituency || '—'}</p>
                <p className="text-ink font-medium">PC: {inspectVoter.parliamentaryConstituency || '—'}</p>
              </div>

              <div className="border border-hairline rounded-lg p-3 bg-canvas space-y-1 col-span-2">
                <p className="text-[10px] font-bold text-muted uppercase">Registered Address</p>
                <p className="text-ink font-medium">
                  {[
                    inspectVoter.homePollingStation ? `Station: ${inspectVoter.homePollingStation}` : '',
                    inspectVoter.ward ? `Ward: ${inspectVoter.ward}` : '',
                    inspectVoter.partNo ? `Part: ${inspectVoter.partNo}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No station recorded'}
                </p>
                <p className="text-body text-[11px]">
                  {[inspectVoter.city || inspectVoter.village, inspectVoter.district, inspectVoter.state]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </p>
              </div>
            </div>

            {/* Audit Metadata */}
            <div className="border-t border-hairline pt-3 text-[11px] text-muted space-y-1">
              <p>Import Source: <span className="font-medium text-ink uppercase">{inspectVoter.source}</span></p>
              <p>Database Record ID: <span className="font-mono text-ink">{inspectVoter._id}</span></p>
              {inspectVoter.createdAt && (
                <p>Enrolled On: <span className="text-ink">{new Date(inspectVoter.createdAt).toLocaleString()}</span></p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setInspectVoter(null)}
                className="w-full bg-primary text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-primary/90 transition cursor-pointer"
              >
                Close Verification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
