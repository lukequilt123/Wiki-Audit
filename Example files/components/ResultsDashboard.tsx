import React, { useState } from 'react';
import { AuditResult } from '../types';

interface ResultsDashboardProps {
  result: AuditResult | null;
  error?: string;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ result, error }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Helper to extract the markdown table
  const extractMarkdownTable = (text: string): string => {
    if (!text) return "";
    const lines = text.split('\n');
    const tableLines: string[] = [];
    let insideTable = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const lower = trimmed.toLowerCase();
      if (!insideTable && trimmed.includes('|') && (lower.includes('source') || lower.includes('url'))) {
        insideTable = true;
        tableLines.push(trimmed);
        continue;
      }
      if (insideTable) {
        if (trimmed.startsWith('|')) {
          tableLines.push(trimmed);
        } else if (trimmed === '') {
          continue;
        } else {
          break;
        }
      }
    }
    return tableLines.length === 0 ? text : tableLines.join('\n');
  };

  const getStatusBadge = (text: string) => {
    const lower = text.toLowerCase();
    let bg = "bg-slate-100", txt = "text-slate-600", dot = "bg-slate-400";
    
    if (lower.includes('approved') || text.includes('✅')) {
      bg = "bg-emerald-50"; txt = "text-emerald-700"; dot = "bg-emerald-500";
    } else if (lower.includes('rejected') || text.includes('⛔')) {
      bg = "bg-rose-50"; txt = "text-rose-700"; dot = "bg-rose-500";
    } else if (lower.includes('caution') || text.includes('⚠️')) {
      bg = "bg-amber-50"; txt = "text-amber-700"; dot = "bg-amber-500";
    }

    const cleanText = text.replace(/✅|⛔|⚠️/g, '').trim();
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${bg} ${txt}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${dot}`}></span>
        {cleanText || text}
      </span>
    );
  };

  const getEffectiveStatus = (originalStatus: string, tierText: string) => {
    const tier = (tierText || "").toLowerCase();
    const rejectedKeywords = ["fan site", "user-generated", "deprecated", "niche blog", "gossip"];
    const cautionKeywords = ["self-published", "primary", "press release", "company blog"];

    if (rejectedKeywords.some(k => tier.includes(k))) {
      return "⛔ REJECTED";
    }
    if (cautionKeywords.some(k => tier.includes(k))) {
      return "⚠️ CAUTION";
    }
    return originalStatus;
  };

  const extractUrl = (text: string) => {
    const urlMatch = (text || "").match(/https?:\/\/[^\s\)]+/);
    return urlMatch ? urlMatch[0] : '';
  };

  const handleCopyRef = (sourceText: string, rowIndex: number) => {
    const url = extractUrl(sourceText);
    if (!url) return;
    const today = new Date().toISOString().split('T')[0];
    const template = `{{cite web |url=${url} |title=Source |access-date=${today}}}`;
    navigator.clipboard.writeText(template).then(() => {
      setCopiedIndex(rowIndex);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const handleDownloadCSV = () => {
    if (!result) return;
    const markdown = extractMarkdownTable(result.markdownTable);
    const lines = markdown.trim().split('\n').filter(line => line.trim().length > 0);
    const headerIndex = lines.findIndex(l => l.includes('|') && (l.toLowerCase().includes('source') || l.toLowerCase().includes('url')));
    if (headerIndex === -1) return;

    const originalHeaders = lines[headerIndex].split('|').map(h => h.trim()).filter(h => h.length > 0);
    const findIdx = (keywords: string[]) => originalHeaders.findIndex(h => keywords.some(k => h.toLowerCase().includes(k)));
    const idx = { 
      src: findIdx(['source', 'url']), 
      status: findIdx(['status', 'reliability']), 
      tier: findIdx(['tier']), 
      rule: findIdx(['flag', 'policy']), 
      usage: findIdx(['action']) 
    };

    const rows = lines.slice(headerIndex + 1).filter(l => l.includes('|') && !/^[|\s-:]+$/.test(l)).map(l => {
      const cells = l.split('|').map(c => c.trim());
      if (cells[0] === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      return cells;
    });

    const sanitize = (t: string) => {
      if (!t) return "";
      const clean = t.replace(/✅|⛔|⚠️/g, '').trim();
      return clean.includes(',') || clean.includes('"') ? `"${clean.replace(/"/g, '""')}"` : clean;
    };

    const csvRows = [["Source URL", "The Verdict", "Tier Classification", "The Rule", "The Limit/Usage"].join(",")];
    rows.forEach(row => {
      const tierText = row[idx.tier] || '';
      const statusText = row[idx.status] || '';
      const effectiveStatus = getEffectiveStatus(statusText, tierText);
      
      csvRows.push([
        sanitize(row[idx.src]), 
        sanitize(effectiveStatus), 
        sanitize(tierText), 
        sanitize(row[idx.rule]), 
        sanitize(row[idx.usage])
      ].join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "wiki-audit-report.csv";
    link.click();
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8 flex items-start">
        <div className="ml-4">
          <h3 className="text-sm font-bold text-red-800">Analysis Failed</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  // Parsing logic
  const markdown = extractMarkdownTable(result.markdownTable);
  const lines = markdown.trim().split('\n').filter(l => l.trim().length > 0);
  const headerIndex = lines.findIndex(l => l.includes('|') && (l.toLowerCase().includes('source') || l.toLowerCase().includes('url')));

  let rows: string[][] = [];
  let rawHeaders: string[] = [];
  let isTableValid = false;

  if (headerIndex !== -1) {
    rawHeaders = lines[headerIndex].split('|').map(h => h.trim()).filter(h => h.length > 0);
    rows = lines.slice(headerIndex + 1).filter(l => l.includes('|') && !/^[|\s-:]+$/.test(l)).map(l => {
      const cells = l.split('|').map(c => c.trim());
      if (cells[0] === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      return cells;
    });
    if (rows.length > 0) {
      isTableValid = true;
    }
  }

  const getDisplayHeader = (h: string) => {
    const l = h.toLowerCase();
    if (l.includes('status') || l.includes('reliability')) return "The Verdict";
    if (l.includes('flag') || l.includes('policy')) return "The Rule";
    if (l.includes('action')) return "The Limit / Usage";
    return h;
  };

  const tierColIdx = rawHeaders.findIndex(h => h.toLowerCase().includes('tier'));
  const hasRawContent = (result.rawText && result.rawText.trim().length > 0) || (result.markdownTable && result.markdownTable.trim().length > 0);

  return (
    <div className="space-y-6 animate-fade-in w-full">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden w-full">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Findings</h2>
            <p className="text-sm text-slate-500 mt-1">Gemini Pro • {new Date().toLocaleDateString()}</p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">Live Verified</span>
        </div>

        {isTableValid ? (
          <>
            <div className="p-0 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {rawHeaders.map((h, i) => (
                      <th key={i} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[120px]">
                        {getDisplayHeader(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                      {row.map((cell, cIdx) => {
                        const header = rawHeaders[cIdx] ? rawHeaders[cIdx].toLowerCase() : '';
                        const isStatus = header.includes('status') || header.includes('reliability');
                        const isSource = header.includes('source') || header.includes('url');
                        const isAction = header.includes('action');

                        const tierText = tierColIdx !== -1 ? row[tierColIdx] : '';

                        return (
                          <td key={cIdx} className="px-6 py-5 text-sm text-slate-700 align-top leading-relaxed">
                            {isStatus ? (
                              getStatusBadge(getEffectiveStatus(cell, tierText))
                            ) : isSource ? (
                               <a href={cell.startsWith('http') ? cell : `https://${cell}`} target="_blank" rel="noreferrer" className="text-blue-600 font-medium hover:underline break-all">{cell}</a>
                             ) : isAction ? (
                               <div className="flex flex-col gap-2">
                                 <span>{cell}</span>
                                 {extractUrl(row[0]) && !getEffectiveStatus(row[1], tierText).toLowerCase().includes('rejected') && (
                                   <button onClick={() => handleCopyRef(row[0], rIdx)} className="w-fit inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition-colors">
                                     {copiedIndex === rIdx ? "Copied!" : "Copy Wiki-Ref"}
                                   </button>
                                 )}
                               </div>
                             ) : <span>{cell}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs font-medium text-slate-500">Automated Audit Report</span>
              <button onClick={handleDownloadCSV} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
                Download CSV
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </>
        ) : hasRawContent ? (
          <div className="p-8 space-y-4">
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200 w-fit">
              <span className="text-lg">⚠️</span>
              <span className="text-sm font-bold">Auto-Formatting Failed. Showing raw output below.</span>
            </div>
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 font-mono text-sm whitespace-pre-wrap overflow-x-auto text-slate-800 leading-relaxed shadow-inner">
              {result.rawText || result.markdownTable}
            </div>
          </div>
        ) : (
          <div className="p-8">
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-200 w-full">
              <span className="text-lg">❌</span>
              <span className="text-sm font-bold">Error: No data received from AI. Please try re-submitting your request.</span>
            </div>
          </div>
        )}
      </div>

      {result.groundingChunks.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
           <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-50 rounded-lg mr-3">
                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" strokeWidth={2}/></svg>
              </div>
              <h3 className="text-sm font-bold text-slate-900">Verification Sources</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             {result.groundingChunks.map((chunk, idx) => chunk.web && (
                <a key={idx} href={chunk.web.uri} target="_blank" rel="noreferrer" className="flex items-center p-3 rounded-lg border border-slate-100 hover:bg-blue-50/30 transition-all group">
                  <span className="text-sm text-slate-600 font-medium truncate group-hover:text-blue-700">{chunk.web.title || chunk.web.uri}</span>
                </a>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};