import React, { useState } from 'react';

interface MarkdownTableParserProps {
  markdown: string;
}

export const MarkdownTableParser: React.FC<MarkdownTableParserProps> = ({ markdown }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const lines = markdown.trim().split('\n').filter(line => line.trim().length > 0);
  
  // Robust header finding: Look for a line with '|' and (Source OR URL)
  const headerIndex = lines.findIndex(line => 
    line.includes('|') && 
    (line.toLowerCase().includes('source') || line.toLowerCase().includes('url'))
  );

  // FAIL-SAFE MODE: If no table header is found, display raw markdown text.
  if (headerIndex === -1) {
    return (
      <div className="p-6 bg-slate-50 text-slate-800 text-sm font-mono whitespace-pre-wrap overflow-x-auto">
        {markdown}
      </div>
    );
  }

  const headers = lines[headerIndex]
    .split('|')
    .map(h => h.trim())
    .filter(h => h.length > 0);

  // Identify column indices to handle logic (Action button, Status check, URL extraction)
  // We use the original markdown headers for logic to ensure we find the right data columns
  const actionIndex = headers.findIndex(h => h.toLowerCase().includes('action'));
  const statusIndex = headers.findIndex(h => h.toLowerCase().includes('status') || h.toLowerCase().includes('reliability'));
  const sourceIndex = headers.findIndex(h => h.toLowerCase().includes('source') || h.toLowerCase().includes('url'));

  // Parse rows with robust filtering
  const rows = lines.slice(headerIndex + 1)
    .filter(line => line.includes('|')) // Must contain pipe
    .filter(line => !/^[|\s-:]+$/.test(line)) // Exclude separator lines like |---|---| or |:---|
    .map(line => {
        const cells = line.split('|');
        const cleanCells = cells.map(c => c.trim());
        // Markdown tables often have leading/trailing pipes which create empty first/last tokens
        if (cleanCells[0] === '') cleanCells.shift();
        if (cleanCells.length > 0 && cleanCells[cleanCells.length - 1] === '') cleanCells.pop();
        return cleanCells;
    });

  const extractUrl = (text: string) => {
    // Matches http/s URLs, stopping at whitespace or closing parenthesis (common in markdown links)
    const urlMatch = text.match(/https?:\/\/[^\s\)]+/);
    return urlMatch ? urlMatch[0] : '';
  };

  const handleCopyRef = (sourceText: string, rowIndex: number) => {
    const url = extractUrl(sourceText);
    if (!url) return;

    const today = new Date().toISOString().split('T')[0];
    // Wikipedia {{cite web}} template format
    const template = `{{cite web |url=${url} |title=Source |access-date=${today}}}`;
    
    navigator.clipboard.writeText(template).then(() => {
      setCopiedIndex(rowIndex);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const getStatusBadge = (text: string) => {
    const lower = text.toLowerCase();
    // Default Style
    let bg = "bg-slate-100";
    let txt = "text-slate-600";
    let dot = "bg-slate-400";
    
    if (lower.includes('approved') || text.includes('✅')) {
      bg = "bg-emerald-50";
      txt = "text-emerald-700";
      dot = "bg-emerald-500";
    } else if (lower.includes('rejected') || text.includes('⛔')) {
      bg = "bg-rose-50";
      txt = "text-rose-700";
      dot = "bg-rose-500";
    } else if (lower.includes('caution') || text.includes('⚠️')) {
      bg = "bg-amber-50";
      txt = "text-amber-700";
      dot = "bg-amber-500";
    }

    const cleanText = text.replace(/✅|⛔|⚠️/g, '').trim();

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${bg} ${txt}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${dot}`}></span>
        {cleanText || text}
      </span>
    );
  };

  // Helper to rename headers for educational display
  const getDisplayHeader = (header: string) => {
    const h = header.toLowerCase();
    if (h.includes('status') || h.includes('reliability')) return "The Verdict";
    if (h.includes('flag') || h.includes('policy')) return "The Rule";
    if (h.includes('action')) return "The Limit / Usage";
    return header;
  };

  // Improved column widths for text wrapping and responsive expansion
  const getColumnClasses = (header: string) => {
    const h = header.toLowerCase();
    // Using percentages that sum up reasonably to ~100%, but min-widths ensure readability on small screens
    if (h.includes('source') || h.includes('url')) return "w-[25%] min-w-[200px] break-words whitespace-normal";
    if (h.includes('status') || h.includes('reliability')) return "w-[12%] min-w-[140px] whitespace-nowrap";
    if (h.includes('tier')) return "w-[13%] min-w-[120px]";
    if (h.includes('action')) return "w-[30%] min-w-[240px] break-words whitespace-normal";
    if (h.includes('flag') || h.includes('policy')) return "w-[20%] min-w-[150px] break-words";
    return "auto whitespace-normal";
  };

  return (
    <div className="flex flex-col w-full">
      <div className="overflow-x-auto w-full">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  {headers.map((h, i) => (
                    <th 
                      key={i} 
                      scope="col" 
                      className={`px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider ${getColumnClasses(h)}`}
                    >
                      {getDisplayHeader(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {rows.map((row, rIndex) => (
                  <tr key={rIndex} className="hover:bg-slate-50/80 transition-colors duration-150">
                    {row.map((cell, cIndex) => {
                      const header = headers[cIndex] || '';
                      const isStatus = header.toLowerCase().includes('status') || header.toLowerCase().includes('reliability');
                      const isSource = header.toLowerCase().includes('source') || header.toLowerCase().includes('url');
                      const isAction = cIndex === actionIndex;
                      
                      return (
                        <td 
                          key={cIndex} 
                          className={`px-6 py-5 text-sm text-slate-700 leading-relaxed align-top ${getColumnClasses(header)}`}
                        >
                          {isStatus ? (
                            getStatusBadge(cell)
                          ) : isSource && (cell.startsWith('http') || cell.includes('.')) ? (
                             <a href={cell.startsWith('http') ? cell : `https://${cell}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 font-medium hover:underline break-all">
                               {cell}
                             </a>
                          ) : isAction ? (
                            <div className="flex flex-col items-start gap-2">
                              <span className="font-medium text-slate-800">{cell}</span>
                              {/* Show Copy Button if not Rejected and we found a source URL */}
                              {(() => {
                                const status = row[statusIndex] || '';
                                const isRejected = status.toLowerCase().includes('rejected') || status.includes('⛔');
                                const sourceText = row[sourceIndex] || '';
                                const hasUrl = extractUrl(sourceText).length > 0;
                                
                                if (!isRejected && hasUrl) {
                                  return (
                                    <button
                                      onClick={() => handleCopyRef(sourceText, rIndex)}
                                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 border border-blue-200 transition-colors"
                                      title="Copy Wikipedia citation template"
                                    >
                                      {copiedIndex === rIndex ? (
                                        <>
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                          <span>Copied!</span>
                                        </>
                                      ) : (
                                        <>
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                          <span>Copy Wiki-Ref</span>
                                        </>
                                      )}
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          ) : (
                            <span>{cell}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};