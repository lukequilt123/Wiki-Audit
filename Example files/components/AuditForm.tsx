import React, { useState } from 'react';

interface AuditFormProps {
  onAudit: (topic: string, sources: string) => void;
  isLoading: boolean;
}

export const AuditForm: React.FC<AuditFormProps> = ({ onAudit, isLoading }) => {
  const [topic, setTopic] = useState('');
  const [sources, setSources] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sources.trim()) {
      onAudit(topic, sources);
    }
  };

  return (
    <div className="bg-white shadow-sm border border-wiki-border rounded-lg p-6 mb-8">
      <h2 className="text-xl font-serif font-medium text-wiki-black mb-4 border-b border-wiki-gray pb-2">
        Request Compliance Audit
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="topic" className="block text-sm font-semibold text-gray-700 mb-1">
            Subject / Article Topic <span className="font-normal text-gray-400 italic">(Optional)</span>
          </label>
          <p className="text-xs text-gray-500 mb-2">
            The controversy level of the topic affects WP:PSTS (Primary Source) tolerance.
          </p>
          <input
            type="text"
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-2 focus:ring-wiki-blue focus:border-wiki-blue outline-none transition"
            placeholder="e.g. SpaceX Starship, 2024 Election, New Pharmaceutical Drug"
          />
        </div>

        <div>
          <label htmlFor="sources" className="block text-sm font-semibold text-gray-700 mb-1">
            Sources to Evaluate
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Paste a list of URLs, domains, or citations (one per line).
          </p>
          <textarea
            id="sources"
            rows={6}
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-2 focus:ring-wiki-blue focus:border-wiki-blue outline-none transition font-mono text-sm"
            placeholder="https://www.nytimes.com/...&#10;https://medium.com/some-blog/...&#10;Press Release from Company X..."
            required
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading || !sources.trim()}
            className={`
              inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white 
              ${isLoading || !sources.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-wiki-blue hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wiki-blue'}
            `}
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Auditing...
              </span>
            ) : (
              'Run Compliance Audit'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};