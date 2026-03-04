import React, { useState, useCallback } from 'react';
import { AuditForm } from './components/AuditForm';
import { ResultsDashboard } from './components/ResultsDashboard';
import { auditSources } from './services/geminiService';
import { AuditResult, ProcessingState } from './types';

const App: React.FC = () => {
  const [processingState, setProcessingState] = useState<ProcessingState>({ status: 'idle' });
  const [result, setResult] = useState<AuditResult | null>(null);

  const handleAuditRequest = useCallback(async (topic: string, sources: string) => {
    setProcessingState({ status: 'analyzing' });
    setResult(null);
    
    try {
      const data = await auditSources(topic, sources);
      setResult(data);
      setProcessingState({ status: 'complete' });
    } catch (error: any) {
      setProcessingState({ 
        status: 'error', 
        error: error.message || 'An unknown error occurred during the audit.' 
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Modern SaaS Header */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 md:px-8 sticky top-0 z-30">
        <div className="w-full mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
             <div className="bg-blue-600 text-white p-1.5 rounded-lg">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             <h1 className="text-lg font-bold tracking-tight text-slate-900">
               WikiAudit <span className="text-slate-400 font-medium">Dashboard</span>
             </h1>
          </div>
          <div className="flex items-center space-x-6 text-sm font-medium text-slate-500">
            <a href="#" className="hover:text-blue-600 transition-colors">Documentation</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Policies</a>
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
              JS
            </div>
          </div>
        </div>
      </header>

      {/* Main Container - Full Screen Layout */}
      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Page Header */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Compliance Audit</h2>
          <p className="text-slate-500 max-w-2xl text-lg">
            Evaluate your sources against Wikipedia's reliability standards (WP:RS) with real-time consensus checking.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Input (Takes up 3 cols on large screens) */}
          <div className="lg:col-span-3 space-y-6">
             <AuditForm 
               onAudit={handleAuditRequest} 
               isLoading={processingState.status === 'analyzing'} 
             />
             
             {/* Policy Helper Sidebar - Modernized */}
             <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Reference Guide</h3>
                <ul className="space-y-4">
                  <li className="flex flex-col">
                    <div className="flex items-center mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                      <span className="text-sm font-semibold text-slate-700">Tier 1: High Quality</span>
                    </div>
                    <span className="text-xs text-slate-500 pl-4">Mainstream press, academic journals.</span>
                  </li>
                  <li className="flex flex-col">
                    <div className="flex items-center mb-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
                      <span className="text-sm font-semibold text-slate-700">Tier 2: Contextual</span>
                    </div>
                    <span className="text-xs text-slate-500 pl-4">Op-eds, regional news, industry specific.</span>
                  </li>
                  <li className="flex flex-col">
                    <div className="flex items-center mb-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500 mr-2"></span>
                      <span className="text-sm font-semibold text-slate-700">Tier 3: Deprecated</span>
                    </div>
                    <span className="text-xs text-slate-500 pl-4">Blogs, user-generated, propaganda.</span>
                  </li>
                </ul>
             </div>
          </div>

          {/* Right Column: Output (Takes up 9 cols on large screens) */}
          <div className="lg:col-span-9">
            {processingState.status === 'idle' && (
              <div className="flex flex-col items-center justify-center h-[400px] border border-dashed border-slate-300 rounded-2xl bg-slate-50/50">
                <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-slate-700">No active audit</p>
                <p className="text-sm text-slate-500 mt-1">Submit a request to see the analysis here.</p>
              </div>
            )}
            
            <ResultsDashboard 
              result={result} 
              error={processingState.error} 
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;