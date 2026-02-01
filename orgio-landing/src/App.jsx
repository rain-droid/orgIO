import React, { useState, useEffect } from 'react';

// --- ICONS ---
const RefreshIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
);
const CodeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
);
const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
);
const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
);
const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
);
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
);
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);
const BriefcaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
);
const CalculatorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line><path d="M16 10h.01"></path><path d="M12 10h.01"></path><path d="M8 10h.01"></path><path d="M12 14h.01"></path><path d="M8 14h.01"></path><path d="M12 18h.01"></path><path d="M8 18h.01"></path></svg>
);

// --- LOGO COMPONENT (Updated with Image) ---
const OrgioLogo = ({ darkMode }) => (
  <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
    {/* Using the uploaded image. Ensure image_41e8d7.png is in the public folder */}
    <img
      src="./image_41e8d7.png"
      alt="Orgio"
      className="h-10 w-auto object-contain"
    // Optional: Invert filter for dark mode if the original logo is dark text on transparent
    // style={darkMode ? { filter: 'brightness(0) invert(1)' } : {}} 
    />
  </div>
);

// --- PRODUCT PREVIEW ---
const ProductPreview = ({ darkMode }) => {
  const [activeRole, setActiveRole] = useState('dev');
  const [features, setFeatures] = useState({ sso: false, analytics: false });
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const toggleFeature = (feature) => {
    // Optimistic UI update
    setFeatures(prev => ({ ...prev, [feature]: !prev[feature] }));

    // Show sync animation
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastSync(new Date());
    }, 800); // 800ms simulation
  };

  return (
    <div className="max-w-6xl mx-auto mt-12 bg-white dark:bg-[#0F1623] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl shadow-slate-200/50 dark:shadow-black/50 overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
      <div className="grid md:grid-cols-12 min-h-[550px]">

        {/* SIDEBAR */}
        <div className="hidden md:flex md:col-span-2 flex-col border-r border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 p-4 gap-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">Select Persona</div>
          <button
            onClick={() => setActiveRole('pm')}
            className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${activeRole === 'pm' ? 'bg-white dark:bg-white/10 text-blue-700 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
          >
            <BriefcaseIcon /> Client / PM
          </button>
          <button
            onClick={() => setActiveRole('dev')}
            className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all ${activeRole === 'dev' ? 'bg-white dark:bg-white/10 text-cyan-700 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
          >
            <CodeIcon /> Developer
          </button>
        </div>

        {/* MAIN AREA */}
        <div className={`md:col-span-6 p-8 relative transition-colors duration-500 ${activeRole === 'pm' ? 'bg-white dark:bg-[#0F1623]' : 'bg-[#1e1e1e]'}`}>
          <div className="absolute top-4 right-4 flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
          </div>

          {activeRole === 'pm' ? (
            <div className="animate-fade-in text-slate-900 dark:text-white">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 p-1 rounded">#</span> Client Requirements
              </h3>
              <div className="space-y-4 font-sans text-sm">
                {/* BASE REQ */}
                <div className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-slate-700 dark:text-slate-200">REQ-101: Basic Authentication</p>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">Approved</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">Standard email/password login flow.</p>
                </div>

                {/* SSO DYNAMIC REQ */}
                <div className={`p-4 border rounded-xl shadow-sm transition-all duration-500 ${features.sso ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-500/30' : 'bg-slate-50/50 dark:bg-white/5 border-dashed border-slate-200 dark:border-white/10 opacity-60'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-slate-700 dark:text-slate-200">REQ-102: Enterprise SSO</p>
                    {features.sso ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full animate-pulse">Implemented</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-500 text-[10px] font-bold rounded-full">Pending</span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    {features.sso ? "SAML/SSO integration required for Enterprise clients. (Auto-detected from codebase)" : "Waiting for implementation..."}
                  </p>
                </div>

                {/* ANALYTICS DYNAMIC REQ */}
                <div className={`p-4 border rounded-xl shadow-sm transition-all duration-500 ${features.analytics ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-500/30' : 'bg-slate-50/50 dark:bg-white/5 border-dashed border-slate-200 dark:border-white/10 opacity-60'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-slate-700 dark:text-slate-200">REQ-103: Usage Analytics</p>
                    {features.analytics ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full animate-pulse">Implemented</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-500 text-[10px] font-bold rounded-full">Pending</span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    {features.analytics ? "Mixpanel tracking enabled for all login events. (Auto-detected from codebase)" : "Waiting for implementation..."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // DEV VIEW
            <div className="animate-fade-in text-gray-300 font-mono text-sm">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 font-sans">
                <span className="text-cyan-400">/</span> src/auth/Login.tsx
              </h3>
              <div className="space-y-1">
                <p><span className="text-purple-400">export const</span> Login = () ={'>'} {'{'}</p>
                <p className="pl-4 text-gray-500 italic">// Core Logic</p>
                <p className="pl-4"><span className="text-blue-400">const</span> [email, setEmail] = useState('');</p>

                {/* INTERACTIVE TOGGLES */}
                <div className="pl-4 my-4 space-y-2">
                  <div
                    onClick={() => toggleFeature('sso')}
                    className={`cursor-pointer p-2 rounded border transition-all ${features.sso ? 'bg-cyan-900/20 border-cyan-500/50' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${features.sso ? 'bg-cyan-500 border-cyan-500' : 'border-gray-500'}`}>
                        {features.sso && <CheckIcon />}
                      </div>
                      <span className={features.sso ? 'text-cyan-300' : 'text-gray-500'}>// Enable SSO Logic</span>
                    </div>
                    {features.sso && (
                      <div className="mt-1 pl-6 text-xs text-cyan-200/70">
                        if (isEnterprise) return triggerSAML();
                      </div>
                    )}
                  </div>

                  <div
                    onClick={() => toggleFeature('analytics')}
                    className={`cursor-pointer p-2 rounded border transition-all ${features.analytics ? 'bg-cyan-900/20 border-cyan-500/50' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${features.analytics ? 'bg-cyan-500 border-cyan-500' : 'border-gray-500'}`}>
                        {features.analytics && <CheckIcon />}
                      </div>
                      <span className={features.analytics ? 'text-cyan-300' : 'text-gray-500'}>// Enable Analytics</span>
                    </div>
                    {features.analytics && (
                      <div className="mt-1 pl-6 text-xs text-cyan-200/70">
                        track('login_attempt', user.id);
                      </div>
                    )}
                  </div>
                </div>

                <p className="pl-4">...</p>
                <p>{'}'}</p>
              </div>
              <div className="mt-8 text-center">
                <p className="text-xs text-slate-500">Click the comments to toggle code blocks</p>
              </div>
            </div>
          )}
        </div>

        {/* LOG AREA */}
        <div className="md:col-span-4 bg-slate-50 dark:bg-black/20 border-l border-slate-200 dark:border-white/10 p-6 flex flex-col font-mono text-xs text-slate-600 dark:text-slate-400">
          <div className="text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold mb-6 text-[10px]">Sync Engine Log</div>
          <div className="space-y-4">
            <div className="flex gap-3 items-center opacity-50">
              <span className="text-slate-400 dark:text-slate-600 w-14">[Init]</span>
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-slate-700 dark:text-slate-300">Project loaded</span>
            </div>

            {/* DYNAMIC LOGS */}
            {features.sso && (
              <div className="flex gap-3 items-center animate-fade-in-up">
                <span className="text-slate-400 dark:text-slate-600 w-14">Now</span>
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span className="text-slate-900 dark:text-slate-100 font-bold bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded">Diff: SSO Added</span>
              </div>
            )}
            {features.analytics && (
              <div className="flex gap-3 items-center animate-fade-in-up">
                <span className="text-slate-400 dark:text-slate-600 w-14">Now</span>
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span className="text-slate-900 dark:text-slate-100 font-bold bg-purple-100 dark:bg-purple-900/30 px-1 rounded">Diff: Analytics Added</span>
              </div>
            )}

            {syncing && (
              <div className="flex gap-3 items-center">
                <span className="text-slate-400 dark:text-slate-600 w-14">Sync</span>
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                <span className="text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/30 px-2 py-0.5 rounded border border-cyan-100 dark:border-cyan-500/30">Updating Docs...</span>
              </div>
            )}
          </div>

          <div className="mt-auto pt-6 border-t border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between text-slate-500">
              <span>Status</span>
              <span className={syncing ? "text-cyan-500 font-bold" : "text-green-500 font-bold"}>
                {syncing ? "SYNCING..." : "IDLE"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- ROI CALCULATOR COMPONENT ---
const ROICalculator = () => {
  const [teamSize, setTeamSize] = useState(20);
  const [hourlyRate, setHourlyRate] = useState(85);
  const hoursSavedPerWeek = 4; // Conservative estimate

  // Calculations
  const weeklySavings = teamSize * hoursSavedPerWeek * hourlyRate;
  const annualSavings = weeklySavings * 48; // 48 working weeks

  return (
    <div className="grid md:grid-cols-2 gap-16 items-center">
      <div>
        <h2 className="text-3xl font-bold mb-6 text-slate-900 dark:text-white">
          Calculate your ROI
        </h2>
        <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
          See how much billable time you are losing to "Status Update" meetings and manual Jira maintenance.
        </p>

        <div className="space-y-8">
          {/* Team Size Slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="font-bold text-slate-700 dark:text-slate-300">Team Size (Devs)</label>
              <span className="text-blue-600 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 rounded">{teamSize}</span>
            </div>
            <input
              type="range" min="5" max="100" value={teamSize}
              onChange={(e) => setTeamSize(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Hourly Rate Slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="font-bold text-slate-700 dark:text-slate-300">Avg. Hourly Rate (€)</label>
              <span className="text-blue-600 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 rounded">€{hourlyRate}</span>
            </div>
            <input
              type="range" min="50" max="250" step="5" value={hourlyRate}
              onChange={(e) => setHourlyRate(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/20 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 flex gap-2">
            <LightningIcon />
            <span>Based on avg. <strong>4 hours</strong> saved per dev/week.</span>
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-8 shadow-xl text-center">
        <div className="mb-8">
          <p className="text-slate-500 dark:text-slate-400 uppercase tracking-widest text-xs font-bold mb-2">Weekly Savings</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">€{weeklySavings.toLocaleString()}</p>
        </div>
        <div className="pt-8 border-t border-slate-100 dark:border-white/10">
          <p className="text-blue-600 dark:text-blue-400 uppercase tracking-widest text-sm font-bold mb-2">Projected Annual Savings</p>
          <p className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-cyan-500 dark:from-blue-400 dark:to-cyan-300">
            €{annualSavings.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-4">That's pure profit added to your bottom line.</p>
        </div>
        <button className="w-full mt-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-bold hover:shadow-lg transition-all">
          Start Free Trial
        </button>
      </div>
    </div>
  );
};


export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [annualBilling, setAnnualBilling] = useState(true);

  // Smooth scroll helper
  const scrollTo = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-cyan-200 selection:text-blue-900 overflow-x-hidden transition-colors duration-500 dark:bg-[#0B1120] dark:text-white">

        {/* --- NAVBAR --- */}
        <nav className="fixed w-full z-50 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/10 shadow-sm transition-all duration-500">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <OrgioLogo darkMode={darkMode} />

            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-8 text-sm text-slate-600 dark:text-slate-400 font-medium">
                <button onClick={() => scrollTo('impact')} className="hover:text-blue-900 dark:hover:text-white transition-colors">ROI</button>
                <button onClick={() => scrollTo('how')} className="hover:text-blue-900 dark:hover:text-white transition-colors">How it works</button>
                <button onClick={() => scrollTo('pricing')} className="hover:text-blue-900 dark:hover:text-white transition-colors">Pricing</button>
              </div>

              <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-2 hidden md:block"></div>

              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 transition-all"
              >
                {darkMode ? <SunIcon /> : <MoonIcon />}
              </button>

              <button className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-lg shadow-slate-900/10 dark:shadow-none">
                Start for free
              </button>
            </div>
          </div>
        </nav>

        {/* --- HERO SECTION --- */}
        <main className="relative z-10 pt-44 pb-20 px-6">
          <div className="max-w-5xl mx-auto text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-500/30 text-xs font-bold text-blue-700 dark:text-blue-300 mb-8 shadow-sm animate-fade-in-up">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600 dark:bg-blue-400"></span>
              </span>
              Built for Scale-Ups & Consultancies
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 text-slate-900 dark:text-white leading-[1.1]">
              Increase Billable Hours. <br className="hidden md:block" /> Reduce <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-cyan-500 dark:from-blue-400 dark:to-cyan-300">Overhead</span>.
            </h1>

            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              Orgio keeps code and client specs in sync automatically. Stop wasting non-billable time on manual updates.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => scrollTo('impact')}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#1e3a8a] to-[#06b6d4] hover:shadow-cyan-500/25 text-white rounded-xl font-bold transition-all hover:scale-105 shadow-xl"
              >
                Calculate Efficiency Gain
              </button>
              <button onClick={() => scrollTo('pricing')} className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-all shadow-sm">
                View Pricing
              </button>
            </div>
          </div>

          {/* SOCIAL PROOF */}
          <div className="max-w-6xl mx-auto mb-20 pt-10 border-t border-slate-200 dark:border-white/5">
            <p className="text-center text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-8">Trusted by growing Consultancies & Tech Teams</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
              <span className="text-xl font-bold text-slate-600 dark:text-slate-400">Thoughtworks</span>
              <span className="text-xl font-bold text-slate-600 dark:text-slate-400">Accenture Song</span>
              <span className="text-xl font-bold text-slate-600 dark:text-slate-400">Dept</span>
              <span className="text-xl font-bold text-slate-600 dark:text-slate-400">Valtech</span>
              <span className="text-xl font-bold text-slate-600 dark:text-slate-400">Deloitte Digital</span>
            </div>
          </div>

          {/* PRODUCT PREVIEW */}
          <ProductPreview darkMode={darkMode} />

        </main>

        {/* --- IMPACT / ROI SECTION (UPDATED) --- */}
        <section id="impact" className="py-24 bg-slate-50 dark:bg-[#0B1120] border-t border-slate-100 dark:border-white/5">
          <div className="max-w-7xl mx-auto px-6">
            {/* Uses the new Calculator Component */}
            <ROICalculator />
          </div>
        </section>

        {/* --- HOW IT WORKS GRID --- */}
        <section id="how" className="py-24 bg-white dark:bg-[#0F1623] border-t border-slate-100 dark:border-white/5">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">Why Agencies switch</h2>
              <p className="text-slate-600 dark:text-slate-400">The old way is "Scope Creep". The new way is "Automated Scope Tracking".</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition duration-300 group">
                <div className="w-12 h-12 bg-white dark:bg-blue-900/20 rounded-xl shadow-sm border border-slate-100 dark:border-white/10 flex items-center justify-center mb-6 text-slate-400 dark:text-blue-400 group-hover:text-blue-600 group-hover:border-blue-100 transition-all">
                  <LightningIcon />
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Instant Alignment</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  No more "I didn't know you changed that". Orgio alerts all stakeholders immediately when logic diverges from specs.
                </p>
              </div>
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-cyan-200 dark:hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/5 transition duration-300 group">
                <div className="w-12 h-12 bg-white dark:bg-cyan-900/20 rounded-xl shadow-sm border border-slate-100 dark:border-white/10 flex items-center justify-center mb-6 text-slate-400 dark:text-cyan-400 group-hover:text-cyan-600 group-hover:border-cyan-100 transition-all">
                  <CodeIcon />
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Context-Aware AI</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Our LLM doesn't just write code. It understands the <i>relationship</i> between your Jira tickets and your React components.
                </p>
              </div>
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-purple-200 dark:hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5 transition duration-300 group">
                <div className="w-12 h-12 bg-white dark:bg-purple-900/20 rounded-xl shadow-sm border border-slate-100 dark:border-white/10 flex items-center justify-center mb-6 text-slate-400 dark:text-purple-400 group-hover:text-purple-600 group-hover:border-purple-100 transition-all">
                  <CheckCircleIcon />
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Zero "Dead Docs"</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Documentation usually rots. Ours lives. Orgio auto-updates your Confluence/Notion pages based on Git commits.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- PRICING SECTION --- */}
        <section id="pricing" className="py-24 bg-white dark:bg-[#0F1623] border-t border-slate-100 dark:border-white/5 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-slate-900 dark:text-white">Invest in Focus, not Meetings.</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8">Save 4+ hours per developer every week. ROI in 14 days.</p>

              {/* Billing Toggle */}
              <div className="inline-flex items-center bg-slate-100 dark:bg-white/10 rounded-full p-1 border border-slate-200 dark:border-white/5">
                <button
                  onClick={() => setAnnualBilling(false)}
                  className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${!annualBilling ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setAnnualBilling(true)}
                  className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${annualBilling ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Yearly <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">-20%</span>
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
              {/* Starter Plan */}
              <div className="p-8 rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 transition-all">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Starter</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">For small teams (&lt; 10 FTEs).</p>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full uppercase tracking-wide">Early Mover</span>
                    <span className="text-xs text-slate-400 line-through">€{annualBilling ? '79' : '99'}</span>
                  </div>
                  <span className="text-4xl font-extrabold text-slate-900 dark:text-white">€{annualBilling ? '69' : '89'}</span>
                  <span className="text-slate-500 dark:text-slate-400">/user/mo</span>
                </div>
                <button className="w-full py-3 px-4 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 transition-all mb-8">
                  Start Free Trial
                </button>
                <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-3"><span className="text-blue-500"><CheckIcon /></span> Real-time Bi-directional Sync</li>
                  <li className="flex items-center gap-3"><span className="text-blue-500"><CheckIcon /></span> Jira & GitHub Integration</li>
                  <li className="flex items-center gap-3"><span className="text-blue-500"><CheckIcon /></span> 3 Projects included</li>
                  <li className="flex items-center gap-3 text-slate-400 dark:text-slate-600"><span className="opacity-50"><CheckIcon /></span> No Voice Features</li>
                </ul>
              </div>

              {/* Professional Plan */}
              <div className="p-8 rounded-3xl border-2 border-blue-500 dark:border-blue-500 bg-white dark:bg-[#0F1623] shadow-2xl relative transform scale-105 z-10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                  Most Popular
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Professional</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">For Scale-Ups & Consultancies (20+ FTEs).</p>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full uppercase tracking-wide">Early Mover</span>
                    <span className="text-xs text-slate-400 line-through">€{annualBilling ? '129' : '159'}</span>
                  </div>
                  <span className="text-5xl font-extrabold text-slate-900 dark:text-white">€{annualBilling ? '119' : '149'}</span>
                  <span className="text-slate-500 dark:text-slate-400">/user/mo</span>
                </div>
                <button className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-lg hover:shadow-blue-500/25 text-white rounded-xl font-bold transition-all mb-8 transform hover:-translate-y-0.5">
                  Get Started
                </button>
                <ul className="space-y-4 text-sm text-slate-700 dark:text-slate-200 font-medium">
                  <li className="flex items-center gap-3"><span className="text-blue-500"><CheckIcon /></span> <strong>Everything in Starter</strong></li>
                  <li className="flex items-center gap-3"><span className="text-blue-500"><CheckIcon /></span> Unlimited Projects</li>
                  <li className="flex items-center gap-3"><span className="text-blue-500"><CheckIcon /></span> Voice Input & Summaries (Add-on)</li>
                  <li className="flex items-center gap-3"><span className="text-blue-500"><CheckIcon /></span> Automated Client Reporting</li>
                  <li className="flex items-center gap-3"><span className="text-blue-500"><CheckIcon /></span> Visual Diffing for Designers</li>
                  <li className="flex items-center gap-3"><span className="text-blue-500"><CheckIcon /></span> Priority Support</li>
                </ul>
              </div>

              {/* Enterprise Plan */}
              <div className="p-8 rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 transition-all">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Enterprise</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Security & Control for Organizations (50+ FTEs).</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-slate-900 dark:text-white">Custom</span>
                </div>
                <button className="w-full py-3 px-4 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 transition-all mb-8">
                  Contact Sales
                </button>
                <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-3"><span className="text-blue-500"><CheckIcon /></span> SSO (SAML/Okta)</li>
                  <li className="flex items-center gap-3"><span className="text-blue-500"><CheckIcon /></span> On-Premise / VPC Option</li>
                  <li className="flex items-center gap-3"><span className="text-blue-500"><CheckIcon /></span> Audit Logs</li>
                  <li className="flex items-center gap-3"><span className="text-blue-500"><CheckIcon /></span> Dedicated Success Manager</li>
                </ul>
              </div>
            </div>

            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-12">
              Prices exclude VAT. Voice features available as an add-on (+€25/mo) on Professional plan.
            </p>
          </div>
        </section>

        {/* --- FOOTER CTA --- */}
        <footer className="py-24 border-t border-slate-200 dark:border-white/10 text-center bg-white dark:bg-[#0F1623] relative overflow-hidden transition-colors duration-500">
          <div className="relative z-10 max-w-2xl mx-auto px-6">
            <h2 className="text-4xl font-bold mb-6 text-slate-900 dark:text-white">Ready to reclaim your time?</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-10 text-lg">Join high-velocity teams who replaced update meetings with Orgio.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <input type="email" placeholder="dev@agency.com" className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/20 rounded-xl px-5 py-4 w-full sm:w-72 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 shadow-sm transition-all" />
              <button className="bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 px-8 py-4 rounded-xl font-bold shadow-xl shadow-slate-900/10 dark:shadow-none transition-all transform hover:-translate-y-0.5">Start Free Trial</button>
            </div>
            <p className="mt-6 text-xs text-slate-400">No credit card required. Cancel anytime.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
