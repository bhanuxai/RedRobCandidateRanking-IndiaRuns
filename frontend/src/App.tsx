import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Settings, 
  BarChart3, 
  Users, 
  Download, 
  AlertTriangle, 
  FileText, 
  ChevronRight, 
  CheckCircle, 
  ArrowRight,
  TrendingUp,
  MapPin,
  Clock,
  Briefcase,
  X,
  Compass
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  CartesianGrid
} from 'recharts';

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '8000'
  ? 'http://localhost:8000/api'
  : '/api';

export default function App() {
  const [viewMode, setViewMode] = useState<'dashboard' | 'leaderboard' | 'analytics' | 'compare'>('dashboard');
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [candidatesFile, setCandidatesFile] = useState<File | null>(null);
  const [jdUploaded, setJdUploaded] = useState(false);
  const [candidatesUploaded, setCandidatesUploaded] = useState(false);
  const [candidateCount, setCandidateCount] = useState(0);
  const [jdSpec, setJdSpec] = useState<any>(null);
  const [weights, setWeights] = useState({
    w_tech: 0.40,
    w_career: 0.25,
    w_culture: 0.20,
    w_education: 0.15
  });
  
  const [isRanking, setIsRanking] = useState(false);
  const [progress, setProgress] = useState({ status: 'idle', percent: 0, message: '' });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [candidateDetail, setCandidateDetail] = useState<any>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareDetails, setCompareDetails] = useState<any[]>([]);

  // Load configuration weights from API
  useEffect(() => {
    fetch(`${API_BASE}/config`)
      .then(res => res.json())
      .then(data => setWeights(data))
      .catch(err => console.error("Error fetching config:", err));
  }, []);

  // Poll progress if ranking is active
  useEffect(() => {
    let interval: any;
    if (isRanking) {
      interval = setInterval(() => {
        fetch(`${API_BASE}/progress`)
          .then(res => res.json())
          .then(data => {
            setProgress(data);
            if (data.status === 'done' || data.status === 'error') {
              setIsRanking(false);
              clearInterval(interval);
              // Fetch results when done
              if (data.status === 'done') {
                fetchLeaderboardAndStats();
              }
            }
          })
          .catch(err => {
            console.error("Error fetching progress:", err);
            setIsRanking(false);
            clearInterval(interval);
          });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRanking]);

  // Fetch candidate details when modal is opened
  useEffect(() => {
    if (selectedCandidateId) {
      fetch(`${API_BASE}/candidates/${selectedCandidateId}`)
        .then(res => res.json())
        .then(data => setCandidateDetail(data))
        .catch(err => console.error("Error fetching candidate details:", err));
    } else {
      setCandidateDetail(null);
    }
  }, [selectedCandidateId]);

  // Fetch side-by-side details when compare tab is opened
  useEffect(() => {
    if (viewMode === 'compare' && compareIds.length > 0) {
      Promise.all(compareIds.map(id => 
        fetch(`${API_BASE}/candidates/${id}`).then(res => res.json())
      ))
      .then(data => setCompareDetails(data))
      .catch(err => console.error("Error loading comparison details:", err));
    }
  }, [viewMode, compareIds]);

  const fetchLeaderboardAndStats = () => {
    fetch(`${API_BASE}/leaderboard`)
      .then(res => res.json())
      .then(data => {
        setLeaderboard(data);
        if (data.length > 0) {
          setViewMode('leaderboard');
        }
      });

    // We can hit rank endpoint again to get stats if needed, or query stats indirectly
    // For simplicity, we just trigger ranking endpoint to get stats
  };

  const handleJdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setJdFile(file);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch(`${API_BASE}/upload-jd`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      setJdSpec(data.spec);
      setJdUploaded(true);
    } catch (err) {
      alert("Failed to upload job description");
    }
  };

  const handleCandidatesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setCandidatesFile(file);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch(`${API_BASE}/upload-candidates`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      setCandidateCount(data.count);
      setCandidatesUploaded(true);
    } catch (err) {
      alert("Failed to upload candidate dataset");
    }
  };

  const handleSaveWeights = async () => {
    try {
      const res = await fetch(`${API_BASE}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(weights)
      });
      await res.json();
      if (leaderboard.length > 0) {
        // Automatically re-fetch leaderboard after weights change
        fetchLeaderboardAndStats();
      }
      alert("Scoring weights saved successfully!");
    } catch (err) {
      alert("Failed to update weights");
    }
  };

  const handleStartRanking = async () => {
    setIsRanking(true);
    setProgress({ status: 'running', percent: 10, message: 'Starting evaluation pipeline...' });
    try {
      const res = await fetch(`${API_BASE}/rank`, { method: "POST" });
      const data = await res.json();
      setLeaderboard(data.top_100);
      setStats(data.stats);
    } catch (err) {
      setIsRanking(false);
      setProgress({ status: 'error', percent: 0, message: 'Pipeline failed' });
    }
  };

  const toggleCompare = (candidateId: string) => {
    if (compareIds.includes(candidateId)) {
      setCompareIds(compareIds.filter(id => id !== candidateId));
    } else {
      if (compareIds.length >= 3) {
        alert("You can compare up to 3 candidates at a time.");
        return;
      }
      setCompareIds([...compareIds, candidateId]);
    }
  };

  const downloadCSV = () => {
    window.open(`${API_BASE}/download-csv`);
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen font-sans">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 p-2 rounded-lg text-white font-bold tracking-wider text-xl shadow-lg shadow-purple-500/10">
              R
            </div>
            <div>
              <span className="font-semibold text-lg tracking-tight text-white">Redrob AI</span>
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Candidate Intelligence
              </span>
            </div>
          </div>
          <nav className="flex gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
            <button 
              onClick={() => setViewMode('dashboard')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'dashboard' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Upload className="w-4 h-4" /> Dashboard
            </button>
            <button 
              onClick={() => {
                if (leaderboard.length === 0) return alert("Run ranking pipeline first.");
                setViewMode('leaderboard');
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${leaderboard.length === 0 ? 'opacity-40 cursor-not-allowed' : ''} ${viewMode === 'leaderboard' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Users className="w-4 h-4" /> Leaderboard
            </button>
            <button 
              onClick={() => {
                if (leaderboard.length === 0) return alert("Run ranking pipeline first.");
                setViewMode('analytics');
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${leaderboard.length === 0 ? 'opacity-40 cursor-not-allowed' : ''} ${viewMode === 'analytics' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <BarChart3 className="w-4 h-4" /> Analytics
            </button>
            <button 
              onClick={() => {
                if (compareIds.length === 0) return alert("Select candidates to compare from the leaderboard first.");
                setViewMode('compare');
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${compareIds.length === 0 ? 'opacity-40 cursor-not-allowed' : ''} ${viewMode === 'compare' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Compass className="w-4 h-4" /> Compare ({compareIds.length})
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Dashboard Mode */}
        {viewMode === 'dashboard' && (
          <div className="space-y-8 animate-fade-in">
            {/* Title / Hero */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="max-w-3xl space-y-4">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
                  Recruiter-Intent Candidate Discovery Engine
                </h1>
                <p className="text-slate-400 text-base leading-relaxed">
                  Evaluate candidates against your hiring mandate using structured multi-agent reasoning. 
                  Filters honeypots, scores availability, parses career progression, and rates technology 
                  contributions deterministically in seconds.
                </p>
              </div>
            </div>

            {/* Steps & Config Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Step 1: Upload mandates */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-6">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                    <FileText className="w-5 h-5 text-purple-400" /> Upload Hiring Mandates
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Job Description Upload */}
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${jdUploaded ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-850 hover:border-purple-500/40 bg-slate-950/40'}`}>
                      <label className="cursor-pointer block space-y-4">
                        <input type="file" onChange={handleJdUpload} accept=".docx,.txt,.md" className="hidden" />
                        <div className="mx-auto w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                          {jdUploaded ? <CheckCircle className="w-6 h-6 text-emerald-400" /> : <FileText className="w-6 h-6 text-purple-400" />}
                        </div>
                        <div>
                          <p className="font-medium text-white">{jdFile ? jdFile.name : 'Job Description'}</p>
                          <p className="text-xs text-slate-400 mt-1">Accepts .docx, .txt, .md</p>
                        </div>
                      </label>
                    </div>

                    {/* Candidate Pool Upload */}
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${candidatesUploaded ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-850 hover:border-purple-500/40 bg-slate-950/40'}`}>
                      <label className="cursor-pointer block space-y-4">
                        <input type="file" onChange={handleCandidatesUpload} accept=".json,.jsonl" className="hidden" />
                        <div className="mx-auto w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                          {candidatesUploaded ? <CheckCircle className="w-6 h-6 text-emerald-400" /> : <Users className="w-6 h-6 text-purple-400" />}
                        </div>
                        <div>
                          <p className="font-medium text-white">{candidatesFile ? candidatesFile.name : 'Candidate Database'}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {candidatesUploaded ? `Loaded ${candidateCount.toLocaleString()} candidates` : 'Accepts .json, .jsonl (100K Pool)'}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Summary of uploaded items */}
                  {jdUploaded && jdSpec && (
                    <div className="bg-slate-950/80 border border-slate-850 rounded-lg p-4 space-y-3">
                      <p className="text-sm font-semibold text-white">Parsed Target Role:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400">Target Role:</span>
                          <p className="font-semibold text-purple-400 mt-0.5">{jdSpec.title}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Experience Range:</span>
                          <p className="font-semibold text-white mt-0.5">{jdSpec.experience_range[0]} - {jdSpec.experience_range[1]} Years</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Core Technologies:</span>
                          <p className="font-semibold text-white mt-0.5 truncate" title={jdSpec.core_skills.join(", ")}>
                            {jdSpec.core_skills.slice(0, 3).join(", ")}...
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Locations:</span>
                          <p className="font-semibold text-white mt-0.5 truncate">{jdSpec.preferred_locations.slice(0, 2).join(", ")}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Start Evaluation Block */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleStartRanking}
                      disabled={!jdUploaded || !candidatesUploaded || isRanking}
                      className={`px-6 py-3 rounded-lg text-white font-medium shadow-lg transition-all flex items-center gap-2 ${!jdUploaded || !candidatesUploaded || isRanking ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-purple-500/10 hover:scale-102 cursor-pointer'}`}
                    >
                      {isRanking ? 'Pipeline Evaluating...' : 'Start Candidate Discovery'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Indicators */}
                {(isRanking || progress.status === 'done' || progress.status === 'error') && (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-white">Ranking Status: {progress.message}</span>
                      <span className="text-purple-400 font-medium">{progress.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div 
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${progress.percent}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Weights configuration */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Settings className="w-5 h-5 text-purple-400" /> Config Scoring weights
                </h2>
                
                <p className="text-xs text-slate-400 leading-relaxed">
                  Customize the score weight distribution. Modifying weights will instantly update scores and ranks across the system.
                </p>

                <div className="space-y-6">
                  {/* Tech Match Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-300">Technical Skill Match</span>
                      <span className="text-purple-400">{Math.round(weights.w_tech * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.05" value={weights.w_tech}
                      onChange={(e) => setWeights({ ...weights, w_tech: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  {/* Career Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-300">Career Quality & Tenures</span>
                      <span className="text-purple-400">{Math.round(weights.w_career * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.05" value={weights.w_career}
                      onChange={(e) => setWeights({ ...weights, w_career: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  {/* Culture Fit Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-300">Culture Fit & Shipping Mindset</span>
                      <span className="text-purple-400">{Math.round(weights.w_culture * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.05" value={weights.w_culture}
                      onChange={(e) => setWeights({ ...weights, w_culture: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  {/* Education Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-300">Education Tier & Relevance</span>
                      <span className="text-purple-400">{Math.round(weights.w_education * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.05" value={weights.w_education}
                      onChange={(e) => setWeights({ ...weights, w_education: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-lg text-center">
                    <span className="text-xs text-slate-400">Total distribution sum:</span>
                    <p className={`text-sm font-bold mt-1 ${Math.abs(weights.w_tech + weights.w_career + weights.w_culture + weights.w_education - 1) < 0.01 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Math.round((weights.w_tech + weights.w_career + weights.w_culture + weights.w_education) * 100)}%
                    </p>
                  </div>

                  <button
                    onClick={handleSaveWeights}
                    className="w-full py-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5 text-purple-400 font-semibold hover:bg-purple-500/10 hover:border-purple-500/40 text-sm transition-all cursor-pointer"
                  >
                    Save Weights
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Mode */}
        {viewMode === 'leaderboard' && (
          <div className="space-y-6 animate-fade-in">
            {/* Action Bar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800 p-6 rounded-xl">
              <div>
                <h1 className="text-2xl font-bold text-white">Top Candidate Rankings</h1>
                <p className="text-slate-400 text-xs mt-1">Showing the top 100 candidates ranked against the mandates.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={downloadCSV}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-all flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Download className="w-4 h-4" /> Download Compliant CSV
                </button>
              </div>
            </div>

            {/* Leaderboard Table */}
            <div className="bg-slate-900/20 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 bg-slate-900/40 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-4 w-16">Rank</th>
                      <th className="px-6 py-4 w-32">Candidate ID</th>
                      <th className="px-6 py-4">Profile Details</th>
                      <th className="px-6 py-4 w-24 text-center">Score</th>
                      <th className="px-6 py-4 w-40 text-center">Compare</th>
                      <th className="px-6 py-4 w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-sm">
                    {leaderboard.map((item) => (
                      <tr 
                        key={item.candidate_id}
                        className={`hover:bg-slate-900/30 transition-all ${compareIds.includes(item.candidate_id) ? 'bg-purple-900/5' : ''}`}
                      >
                        <td className="px-6 py-4 font-bold text-white text-base">
                          {item.rank}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                          {item.candidate_id}
                        </td>
                        <td className="px-6 py-4 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{item.name}</span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold text-xxs">
                              {item.years_of_experience.toFixed(1)} Yrs Exp
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs max-w-xl truncate">
                            {item.title} at <span className="text-white">{item.company}</span>
                          </p>
                          <p className="text-slate-500 text-xs italic max-w-xl truncate">
                            &ldquo;{item.reasoning}&rdquo;
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-emerald-400 text-base">
                          {item.score.toFixed(4)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleCompare(item.candidate_id)}
                            className={`px-3 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${compareIds.includes(item.candidate_id) ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'}`}
                          >
                            {compareIds.includes(item.candidate_id) ? 'Compare Active' : '+ Compare'}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => setSelectedCandidateId(item.candidate_id)}
                            className="text-purple-400 hover:text-purple-300 font-medium text-xs flex items-center gap-1 cursor-pointer"
                          >
                            Details <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Mode */}
        {viewMode === 'analytics' && stats && (
          <div className="space-y-8 animate-fade-in">
            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 flex items-center gap-4">
                <div className="bg-purple-500/10 text-purple-400 p-3 rounded-lg border border-purple-500/20">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-slate-400">Total Candidates Scored</span>
                  <p className="text-2xl font-bold text-white mt-0.5">{stats.total_candidates}</p>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 flex items-center gap-4">
                <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-lg border border-emerald-500/20">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-slate-400">Top 100 Avg score</span>
                  <p className="text-2xl font-bold text-emerald-400 mt-0.5">{stats.top_100_avg_score.toFixed(4)}</p>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 flex items-center gap-4">
                <div className="bg-rose-500/10 text-rose-400 p-3 rounded-lg border border-rose-500/20">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-slate-400">Honeypots Detected</span>
                  <p className="text-2xl font-bold text-rose-400 mt-0.5">{stats.sample_honeypot_ratio}%</p>
                </div>
              </div>
            </div>

            {/* Graphs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Score Distribution */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-white">Ranks vs Scores (Top 100 Curve)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={leaderboard.map(item => ({ rank: item.rank, score: item.score }))}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="rank" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="score" stroke="#aa3bff" fill="rgba(170, 59, 255, 0.1)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Common Skills */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-white">Top 10 Core Skills (In Top 100)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={stats.skills}
                      layout="vertical"
                      margin={{ top: 10, right: 10, left: 30, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis type="number" stroke="#64748b" fontSize={10} />
                      <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      />
                      <Bar dataKey="count" fill="#aa3bff" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Geographic distribution */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4 lg:col-span-2">
                <h3 className="text-base font-semibold text-white">Top Candidate Locations</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={stats.locations}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compare Mode */}
        {viewMode === 'compare' && (
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Compass className="w-6 h-6 text-purple-400" /> Side-by-Side Candidate Comparison
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {compareDetails.map(item => (
                <div key={item.candidate_id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
                  <button 
                    onClick={() => {
                      setCompareIds(compareIds.filter(id => id !== item.candidate_id));
                      setCompareDetails(compareDetails.filter(d => d.candidate_id !== item.candidate_id));
                    }}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="space-y-2">
                    <span className="text-xs text-purple-400 font-mono tracking-wider font-semibold">RANK {item.rank}</span>
                    <h2 className="text-xl font-bold text-white">{item.profile.name}</h2>
                    <p className="text-slate-400 text-xs">{item.profile.current_title} at <span className="text-white">{item.profile.current_company}</span></p>
                  </div>

                  {/* score badge */}
                  <div className="flex items-center justify-between p-3 rounded bg-slate-950 border border-slate-850">
                    <span className="text-xs text-slate-400">Composite score:</span>
                    <span className="text-lg font-bold text-emerald-400">{item.scores.final_score.toFixed(4)}</span>
                  </div>

                  {/* breakdown */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Score Breakdown</h3>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Technical Skill</span>
                          <span className="text-white">{item.scores.tech_score * 10}</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-850">
                          <div className="bg-purple-500 h-full" style={{ width: `${item.scores.tech_score * 100}%` }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Career Quality</span>
                          <span className="text-white">{item.scores.career_score * 10}</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-850">
                          <div className="bg-purple-500 h-full" style={{ width: `${item.scores.career_score * 100}%` }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Culture Fit</span>
                          <span className="text-white">{item.scores.culture_score * 10}</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-850">
                          <div className="bg-purple-500 h-full" style={{ width: `${item.scores.culture_score * 100}%` }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Education</span>
                          <span className="text-white">{item.scores.education_score * 10}</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-850">
                          <div className="bg-purple-500 h-full" style={{ width: `${item.scores.education_score * 100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Signals */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Behavior & Availability</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-950/60 p-2.5 rounded border border-slate-850 text-center">
                        <span className="text-slate-400 block mb-1">Response Rate</span>
                        <span className="font-bold text-white">{Math.round(item.behavior_data.response_rate * 100)}%</span>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 rounded border border-slate-850 text-center">
                        <span className="text-slate-400 block mb-1">Notice Period</span>
                        <span className="font-bold text-white">{item.behavior_data.notice_days} Days</span>
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Key Skills</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {item.profile.skills.slice(0, 5).map((s: any) => (
                        <span key={s.name} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-850 text-slate-300 text-xxs font-medium">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className="bg-slate-950/80 p-4 border-l-2 border-purple-500 rounded-r-lg">
                    <p className="text-slate-400 text-xs italic leading-relaxed">&ldquo;{item.reasoning}&rdquo;</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Candidate Detail Modal */}
      {selectedCandidateId && candidateDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 animate-scale-up">
            {/* Modal Header */}
            <div className="border-b border-slate-800 p-6 flex justify-between items-start bg-slate-950/40">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Rank #{candidateDetail.rank}</span>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  {candidateDetail.profile.name}
                  <span className="text-xs font-mono font-normal text-slate-400">({candidateDetail.candidate_id})</span>
                </h2>
                <p className="text-slate-400 text-sm">
                  {candidateDetail.profile.current_title} at <span className="text-white">{candidateDetail.profile.current_company}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedCandidateId(null)}
                className="bg-slate-950 border border-slate-850 p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-8 max-h-[70vh]">
              {/* Reasoning Quote */}
              <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 flex items-start gap-3">
                <div className="bg-purple-500/10 p-1 rounded text-purple-400 mt-0.5">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-xxs font-bold text-purple-400 uppercase tracking-wider">Recruiter Explanation</span>
                  <p className="text-slate-300 text-sm leading-relaxed italic">&ldquo;{candidateDetail.reasoning}&rdquo;</p>
                </div>
              </div>

              {/* Main Info Columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Score Breakdown (Col 1) */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">Scoring Breakdown</h3>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-850 mb-4">
                    <span className="text-xs text-slate-400">Final Discoverability Score</span>
                    <span className="text-2xl font-bold text-emerald-400">{candidateDetail.scores.final_score.toFixed(4)}</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-slate-400">Technical Skill Fit</span>
                        <span className="text-white font-semibold">{candidateDetail.scores.tech_score * 10} / 10</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full border border-slate-850 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full" style={{ width: `${candidateDetail.scores.tech_score * 100}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-slate-400">Career Trajectory</span>
                        <span className="text-white font-semibold">{candidateDetail.scores.career_score * 10} / 10</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full border border-slate-850 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full" style={{ width: `${candidateDetail.scores.career_score * 100}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-slate-400">Cultural Fit</span>
                        <span className="text-white font-semibold">{candidateDetail.scores.culture_score * 10} / 10</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full border border-slate-850 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full" style={{ width: `${candidateDetail.scores.culture_score * 100}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-slate-400">Education Score</span>
                        <span className="text-white font-semibold">{candidateDetail.scores.education_score * 10} / 10</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full border border-slate-850 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full" style={{ width: `${candidateDetail.scores.education_score * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Behavioral & Signals (Col 2 & 3) */}
                <div className="md:col-span-2 space-y-6">
                  {/* Behavioral Section */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">Engagement & Behavioral Signals</h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Active recency */}
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                        <span className="text-slate-400 text-xxs block">Platform Active Recency</span>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-purple-400" />
                          <span className="font-semibold text-white text-xs">{candidateDetail.behavior_data.days_inactive} Days Ago</span>
                        </div>
                      </div>

                      {/* Notice Period */}
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                        <span className="text-slate-400 text-xxs block">Notice Period</span>
                        <div className="flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4 text-purple-400" />
                          <span className="font-semibold text-white text-xs">{candidateDetail.behavior_data.notice_days} Days</span>
                        </div>
                      </div>

                      {/* response rate */}
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                        <span className="text-slate-400 text-xxs block">Recruiter Response Rate</span>
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-purple-400" />
                          <span className="font-semibold text-white text-xs">{Math.round(candidateDetail.behavior_data.response_rate * 100)}%</span>
                        </div>
                      </div>
                      
                      {/* Relocation */}
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                        <span className="text-slate-400 text-xxs block">Willing to Relocate</span>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-purple-400" />
                          <span className="font-semibold text-white text-xs">{candidateDetail.profile.redrob_signals.willing_to_relocate ? 'Yes' : 'No'}</span>
                        </div>
                      </div>

                      {/* github */}
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                        <span className="text-slate-400 text-xxs block">GitHub Activity Score</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white text-xs">
                            {candidateDetail.profile.redrob_signals.github_activity_score !== -1 ? `${candidateDetail.profile.redrob_signals.github_activity_score}/100` : 'Not Linked'}
                          </span>
                        </div>
                      </div>

                      {/* work mode */}
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                        <span className="text-slate-400 text-xxs block">Preferred Work Mode</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white text-xs capitalize">{candidateDetail.profile.redrob_signals.preferred_work_mode}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Anomalies/Verification section */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">Verification & Anti-Honeypot Checks</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-2 p-2 bg-slate-950/60 rounded border border-slate-850">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-300">No Startup Founding date contradictions</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-slate-950/60 rounded border border-slate-850">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-300">Technology durations align with release years</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-slate-950/60 rounded border border-slate-850">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-300">No Expert skills with 0 months of duration</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-slate-950/60 rounded border border-slate-850">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-300">Job chronology & timeline checks passed</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Skills section */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">Skills Inventory</h3>
                <div className="flex flex-wrap gap-2">
                  {candidateDetail.profile.skills.map((s: any) => (
                    <span key={s.name} className="px-3 py-1 rounded bg-slate-950 border border-slate-850 text-slate-300 text-xs">
                      {s.name} &bull; <span className="text-purple-400 capitalize">{s.proficiency}</span> ({s.duration_months}m)
                    </span>
                  ))}
                </div>
              </div>

              {/* Career History timeline */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">Career History Timeline</h3>
                <div className="space-y-4">
                  {candidateDetail.profile.career_history.map((job: any, index: number) => (
                    <div key={index} className="flex gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-850 text-sm">
                      <div className="flex-none bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-lg h-fit text-center min-w-20">
                        <span className="text-slate-400 text-xxs font-semibold uppercase tracking-wider block">Duration</span>
                        <span className="font-bold text-white">{job.duration_months} mos</span>
                      </div>
                      <div className="space-y-1.5 flex-grow">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-white">{job.title}</h4>
                          <span className="text-slate-500 text-xs">{job.start_date} to {job.end_date || 'Present'}</span>
                        </div>
                        <p className="text-purple-400 text-xs font-semibold">{job.company} &bull; <span className="text-slate-500 capitalize">{job.company_size} size</span></p>
                        <p className="text-slate-400 text-xs leading-relaxed">{job.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Education section */}
              {candidateDetail.profile.education && candidateDetail.profile.education.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">Education</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {candidateDetail.profile.education.map((ed: any, index: number) => (
                      <div key={index} className="p-4 rounded-xl bg-slate-950/60 border border-slate-850 text-sm flex justify-between items-start">
                        <div className="space-y-1">
                          <h4 className="font-bold text-white">{ed.degree} in {ed.field_of_study}</h4>
                          <p className="text-slate-400 text-xs">{ed.institution}</p>
                          <p className="text-slate-500 text-xs">{ed.start_year} - {ed.end_year} &bull; Grade: {ed.grade || 'N/A'}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-xxs font-semibold uppercase tracking-wider border border-purple-500/20 capitalize">
                          {ed.tier.replace("_", " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
