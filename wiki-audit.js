/* ============================================================
   WikiAudit — Application Logic
   Vanilla JS — no dependencies
   ============================================================ */

(function () {
  'use strict';

  // ── CONFIGURATION ────────────────────────────────────────────
  const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  const SYSTEM_INSTRUCTION = `
Act as a strict Wikipedia Policy Administrator (User Group: Sysop). Your goal is to audit a batch of proposed sources to ensure they meet English Wikipedia's sourcing guidelines (WP:RS, WP:V).

**Core Policy Database (Grounding Targets):**
You must verify all inputs against these live policy pages:
1. WP:RSP (Perennial Sources)
2. WP:RS (Reliable Sources)
3. WP:PSTS (Primary vs Secondary)
4. WP:NPOV (Neutral Point of View)

**Audit Logic:**
For every item in the provided source list, execute this sequence:
1. **Identify & Classify:** Determine if the domain is Tier 1 (High Quality), Tier 2 (Contextual/Op-Ed), or Tier 3 (Deprecated/Blog).
2. **The "Noticeboard" Check:** If the source is not explicitly listed on WP:RSP, you MUST use the Google Search tool to query "Wikipedia Reliable Sources Noticeboard [Domain Name]" to find the community consensus.
3. **Primary Source Trap:** If the source is a company website, press release, or social media, flag it as PRIMARY. Reject it if the topic is controversial or used to establish notability.
4. **Tone Polish:** Scan provided text for "peacock terms" (e.g., "legendary," "industry-leading") and flag as WP:NPOV.

**Output Interface:**
Present the findings as a clean Markdown Table with these specific headers:
| Source/URL | Reliability Status | Tier Classification | Policy Flags | Action |

**Rules for Columns:**
- Reliability Status: Must contain one of these icons: ✅ APPROVED | ⚠️ CAUTION | ⛔ REJECTED
- Tier Classification: e.g., "Tier 1: Major Press", "Tier 3: Self-Published"
- Policy Flags: Specific violations (e.g., "WP:PSTS", "WP:NPOV", "WP:RSP")
- Action: One-sentence instruction.

**Configuration:**
- Tone: Objective, pedantic, and strict.
- Do not add conversational text before or after the table. Output ONLY the table.
`;

  // Status inference keywords
  const REJECTED_KEYWORDS = ['fan site', 'user-generated', 'deprecated', 'niche blog', 'gossip'];
  const CAUTION_KEYWORDS = ['self-published', 'primary', 'press release', 'company blog'];

  // ── STATE ────────────────────────────────────────────────────
  let currentResult = null;
  let copiedIndex = null;

  // ── DOM REFERENCES ───────────────────────────────────────────
  let els = {};

  function cacheDom() {
    els = {
      form: document.getElementById('auditForm'),
      topicInput: document.getElementById('topicInput'),
      sourcesInput: document.getElementById('sourcesInput'),
      submitBtn: document.getElementById('submitBtn'),
      formError: document.getElementById('formError'),
      idleState: document.getElementById('idleState'),
      loadingState: document.getElementById('loadingState'),
      errorState: document.getElementById('errorState'),
      errorMessage: document.getElementById('errorMessage'),
      retryBtn: document.getElementById('retryBtn'),
      resultsState: document.getElementById('resultsState'),
      resultsTable: document.getElementById('resultsTable'),
      resultsMeta: document.getElementById('resultsMeta'),
      rawFallback: document.getElementById('rawFallback'),
      rawText: document.getElementById('rawText'),
      csvBtn: document.getElementById('csvBtn'),
      groundingCard: document.getElementById('groundingCard'),
      groundingGrid: document.getElementById('groundingGrid'),
      apiKeyBadge: document.getElementById('apiKeyBadge'),
    };
  }

  // ── API KEY ──────────────────────────────────────────────────
  var STORAGE_KEY = 'wikiaudit_api_key';

  function getApiKey() {
    // 1. config.js (local dev)
    if (window.WIKI_AUDIT_CONFIG && window.WIKI_AUDIT_CONFIG.apiKey &&
        window.WIKI_AUDIT_CONFIG.apiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
      return window.WIKI_AUDIT_CONFIG.apiKey;
    }
    // 2. localStorage (live site / user-entered)
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    return null;
  }

  function promptForApiKey() {
    var current = getApiKey() || '';
    var key = prompt('Enter your Gemini API key:\n(Get one free at aistudio.google.com/apikey)', current);
    if (key === null) return; // cancelled
    key = key.trim();
    if (key) {
      localStorage.setItem(STORAGE_KEY, key);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    updateApiKeyBadge();
  }

  function updateApiKeyBadge() {
    if (!els.apiKeyBadge) return;
    if (getApiKey()) {
      els.apiKeyBadge.textContent = 'API Key: Active';
      els.apiKeyBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      els.apiKeyBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      els.apiKeyBadge.style.color = '#34d399';
      els.apiKeyBadge.style.cursor = 'pointer';
      els.apiKeyBadge.title = 'Click to change API key';
    } else {
      els.apiKeyBadge.textContent = 'API Key: Not Set';
      els.apiKeyBadge.style.background = 'rgba(239, 68, 68, 0.15)';
      els.apiKeyBadge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      els.apiKeyBadge.style.color = '#f87171';
      els.apiKeyBadge.style.cursor = 'pointer';
      els.apiKeyBadge.title = 'Click to enter API key';
    }
  }

  // ── STATE MANAGEMENT ─────────────────────────────────────────
  function setState(state) {
    var panels = ['idleState', 'loadingState', 'errorState', 'resultsState'];
    panels.forEach(function (id) {
      var el = els[id];
      if (el) el.style.display = 'none';
    });

    if (state === 'idle' && els.idleState) els.idleState.style.display = '';
    if (state === 'loading' && els.loadingState) els.loadingState.style.display = '';
    if (state === 'error' && els.errorState) els.errorState.style.display = '';
    if (state === 'results' && els.resultsState) els.resultsState.style.display = '';

    // Toggle form disabled state
    var isLoading = state === 'loading';
    if (els.topicInput) els.topicInput.disabled = isLoading;
    if (els.sourcesInput) els.sourcesInput.disabled = isLoading;
    if (els.submitBtn) {
      els.submitBtn.disabled = isLoading;
      var btnText = els.submitBtn.querySelector('.btn-text');
      var btnSpinner = els.submitBtn.querySelector('.btn-spinner');
      if (btnText) btnText.style.display = isLoading ? 'none' : '';
      if (btnSpinner) btnSpinner.style.display = isLoading ? 'flex' : 'none';
    }
  }

  function showFormError(msg) {
    if (!els.formError) return;
    els.formError.textContent = msg;
    els.formError.style.display = '';
  }

  function hideFormError() {
    if (!els.formError) return;
    els.formError.style.display = 'none';
  }

  // ── GEMINI API CALL ──────────────────────────────────────────
  async function auditSources(topic, sources) {
    var apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please add your key to config.js');
    }

    var prompt = [
      '**Audit Request:**',
      '',
      '**Subject/Article Topic:** ' + (topic || 'Not specified (General Audit)'),
      '',
      '**Sources to Audit:**',
      sources,
      '',
      'CRITICAL: Output ONLY the Markdown Table. Do not write any introductory summary, preamble, or conclusion text. Start the response immediately with the markdown header row.'
    ].join('\n');

    var url = GEMINI_API_URL + '/' + GEMINI_MODEL + ':generateContent?key=' + apiKey;

    var body = {
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1
      },
      tools: [{
        google_search: {}
      }]
    };

    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      var errData;
      try { errData = await response.json(); } catch (e) { errData = {}; }
      var errMsg = (errData.error && errData.error.message) || ('API request failed with status ' + response.status);
      throw new Error(errMsg);
    }

    var data = await response.json();
    var text = '';
    var groundingChunks = [];

    if (data.candidates && data.candidates[0]) {
      var candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts) {
        text = candidate.content.parts.map(function (p) { return p.text || ''; }).join('');
      }
      if (candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) {
        groundingChunks = candidate.groundingMetadata.groundingChunks;
      }
    }

    console.log('Raw Gemini Output:', text);

    return {
      markdownTable: text,
      rawText: text,
      groundingChunks: groundingChunks
    };
  }

  // ── MARKDOWN TABLE PARSING ───────────────────────────────────
  function extractMarkdownTable(text) {
    if (!text) return '';
    var lines = text.split('\n');
    var tableLines = [];
    var insideTable = false;

    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      var lower = trimmed.toLowerCase();

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
  }

  function parseTableRows(markdown) {
    var lines = markdown.trim().split('\n').filter(function (l) { return l.trim().length > 0; });
    var headerIndex = -1;

    for (var i = 0; i < lines.length; i++) {
      if (lines[i].includes('|') && (lines[i].toLowerCase().includes('source') || lines[i].toLowerCase().includes('url'))) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) return null;

    var headers = lines[headerIndex].split('|').map(function (h) { return h.trim(); }).filter(function (h) { return h.length > 0; });

    var rows = [];
    for (var j = headerIndex + 1; j < lines.length; j++) {
      var line = lines[j];
      if (!line.includes('|') || /^[|\s\-:]+$/.test(line)) continue;

      var cells = line.split('|').map(function (c) { return c.trim(); });
      if (cells[0] === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      rows.push(cells);
    }

    return rows.length > 0 ? { headers: headers, rows: rows } : null;
  }

  // ── STATUS INFERENCE ─────────────────────────────────────────
  function getEffectiveStatus(originalStatus, tierText) {
    var tier = (tierText || '').toLowerCase();

    for (var i = 0; i < REJECTED_KEYWORDS.length; i++) {
      if (tier.includes(REJECTED_KEYWORDS[i])) return '⛔ REJECTED';
    }
    for (var j = 0; j < CAUTION_KEYWORDS.length; j++) {
      if (tier.includes(CAUTION_KEYWORDS[j])) return '⚠️ CAUTION';
    }
    return originalStatus;
  }

  function getStatusClass(text) {
    var lower = text.toLowerCase();
    if (lower.includes('approved') || text.includes('✅')) return 'approved';
    if (lower.includes('rejected') || text.includes('⛔')) return 'rejected';
    if (lower.includes('caution') || text.includes('⚠️')) return 'caution';
    return 'unknown';
  }

  function cleanStatusText(text) {
    return text.replace(/✅|⛔|⚠️/g, '').trim();
  }

  // ── DISPLAY HEADER MAPPING ───────────────────────────────────
  function getDisplayHeader(h) {
    var l = h.toLowerCase();
    if (l.includes('status') || l.includes('reliability')) return 'The Verdict';
    if (l.includes('flag') || l.includes('policy')) return 'The Rule';
    if (l.includes('action')) return 'The Limit / Usage';
    return h;
  }

  // ── URL EXTRACTION ───────────────────────────────────────────
  function extractUrl(text) {
    var match = (text || '').match(/https?:\/\/[^\s)]+/);
    return match ? match[0] : '';
  }

  // ── RENDER FUNCTIONS ─────────────────────────────────────────
  function renderResults(data) {
    var markdown = extractMarkdownTable(data.markdownTable);
    var parsed = parseTableRows(markdown);

    if (!parsed) {
      // Show raw fallback
      els.resultsTable.querySelector('thead').innerHTML = '';
      els.resultsTable.querySelector('tbody').innerHTML = '';
      els.rawFallback.style.display = '';
      els.rawText.textContent = data.rawText || data.markdownTable || 'No data received.';
      return;
    }

    els.rawFallback.style.display = 'none';
    var headers = parsed.headers;
    var rows = parsed.rows;

    var tierIdx = -1;
    for (var t = 0; t < headers.length; t++) {
      if (headers[t].toLowerCase().includes('tier')) { tierIdx = t; break; }
    }

    var statusIdx = -1;
    for (var s = 0; s < headers.length; s++) {
      var hl = headers[s].toLowerCase();
      if (hl.includes('status') || hl.includes('reliability')) { statusIdx = s; break; }
    }

    // Build thead
    var theadHtml = '<tr>';
    for (var hi = 0; hi < headers.length; hi++) {
      theadHtml += '<th>' + escapeHtml(getDisplayHeader(headers[hi])) + '</th>';
    }
    theadHtml += '</tr>';

    // Build tbody
    var tbodyHtml = '';
    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      var tierText = tierIdx !== -1 ? (row[tierIdx] || '') : '';
      var delay = (ri * 0.06).toFixed(2);

      tbodyHtml += '<tr class="fade-in" style="animation-delay:' + delay + 's">';

      for (var ci = 0; ci < row.length; ci++) {
        var cell = row[ci] || '';
        var header = headers[ci] || '';
        var displayHeader = getDisplayHeader(header);
        var headerLower = header.toLowerCase();
        var isStatus = headerLower.includes('status') || headerLower.includes('reliability');
        var isSource = headerLower.includes('source') || headerLower.includes('url');
        var isAction = headerLower.includes('action');

        var cellContent = '';

        if (isStatus) {
          var effectiveStatus = getEffectiveStatus(cell, tierText);
          var statusType = getStatusClass(effectiveStatus);
          var statusText = cleanStatusText(effectiveStatus) || effectiveStatus;
          cellContent = '<span class="status-badge status-badge--' + statusType + '">' +
            '<span class="status-dot"></span>' + escapeHtml(statusText) + '</span>';
        } else if (isSource) {
          var url = extractUrl(cell);
          if (url) {
            cellContent = '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener noreferrer" class="source-link">' + escapeHtml(cell) + '</a>';
          } else if (cell.startsWith('http')) {
            cellContent = '<a href="' + escapeAttr(cell) + '" target="_blank" rel="noopener noreferrer" class="source-link">' + escapeHtml(cell) + '</a>';
          } else {
            cellContent = escapeHtml(cell);
          }
        } else if (isAction) {
          var sourceCell = row[0] || '';
          var sourceUrl = extractUrl(sourceCell);
          var rowStatus = statusIdx !== -1 ? getEffectiveStatus(row[statusIdx] || '', tierText) : '';
          var isRejected = rowStatus.toLowerCase().includes('rejected');

          cellContent = '<div class="action-cell"><span>' + escapeHtml(cell) + '</span>';
          if (sourceUrl && !isRejected) {
            cellContent += '<button class="btn-copy-ref" data-url="' + escapeAttr(sourceUrl) + '" data-row="' + ri + '">Copy Wiki-Ref</button>';
          }
          cellContent += '</div>';
        } else {
          cellContent = escapeHtml(cell);
        }

        tbodyHtml += '<td data-label="' + escapeAttr(displayHeader) + '">' + cellContent + '</td>';
      }

      tbodyHtml += '</tr>';
    }

    els.resultsTable.querySelector('thead').innerHTML = theadHtml;
    els.resultsTable.querySelector('tbody').innerHTML = tbodyHtml;

    // Update meta
    els.resultsMeta.textContent = 'Gemini Flash + Google Search \u2022 ' + new Date().toLocaleDateString() + ' \u2022 ' + rows.length + ' source' + (rows.length !== 1 ? 's' : '') + ' audited';

    // Grounding chunks
    if (data.groundingChunks && data.groundingChunks.length > 0) {
      renderGroundingChunks(data.groundingChunks);
      els.groundingCard.style.display = '';
    } else {
      els.groundingCard.style.display = 'none';
    }
  }

  function renderGroundingChunks(chunks) {
    var html = '';
    for (var i = 0; i < chunks.length; i++) {
      var chunk = chunks[i];
      if (chunk.web) {
        var title = chunk.web.title || chunk.web.uri || 'Source';
        html += '<a href="' + escapeAttr(chunk.web.uri) + '" target="_blank" rel="noopener noreferrer" class="grounding-link">' +
          '<span class="grounding-link-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg></span>' +
          '<span class="grounding-link-text">' + escapeHtml(title) + '</span></a>';
      }
    }
    els.groundingGrid.innerHTML = html;
  }

  // ── COPY WIKI-REF ────────────────────────────────────────────
  function handleCopyRef(url, rowIndex) {
    if (!url) return;
    var today = new Date().toISOString().split('T')[0];
    var template = '{{cite web |url=' + url + ' |title=Source |access-date=' + today + '}}';

    navigator.clipboard.writeText(template).then(function () {
      // Update button text
      var btns = document.querySelectorAll('.btn-copy-ref[data-row="' + rowIndex + '"]');
      btns.forEach(function (btn) {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
      });

      if (copiedIndex !== null) clearTimeout(copiedIndex);
      copiedIndex = setTimeout(function () {
        btns.forEach(function (btn) {
          btn.textContent = 'Copy Wiki-Ref';
          btn.classList.remove('copied');
        });
        copiedIndex = null;
      }, 2000);
    });
  }

  // ── CSV DOWNLOAD ─────────────────────────────────────────────
  function handleDownloadCSV() {
    if (!currentResult) return;

    var markdown = extractMarkdownTable(currentResult.markdownTable);
    var parsed = parseTableRows(markdown);
    if (!parsed) return;

    var headers = parsed.headers;
    var rows = parsed.rows;

    // Find column indices
    function findIdx(keywords) {
      return headers.findIndex(function (h) {
        return keywords.some(function (k) { return h.toLowerCase().includes(k); });
      });
    }

    var idx = {
      src: findIdx(['source', 'url']),
      status: findIdx(['status', 'reliability']),
      tier: findIdx(['tier']),
      rule: findIdx(['flag', 'policy']),
      usage: findIdx(['action'])
    };

    function sanitize(t) {
      if (!t) return '';
      var clean = t.replace(/✅|⛔|⚠️/g, '').trim();
      return (clean.includes(',') || clean.includes('"')) ? '"' + clean.replace(/"/g, '""') + '"' : clean;
    }

    var csvRows = ['Source URL,The Verdict,Tier Classification,The Rule,The Limit/Usage'];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var tierText = idx.tier !== -1 ? (row[idx.tier] || '') : '';
      var statusText = idx.status !== -1 ? (row[idx.status] || '') : '';
      var effectiveStatus = getEffectiveStatus(statusText, tierText);

      csvRows.push([
        sanitize(idx.src !== -1 ? row[idx.src] : ''),
        sanitize(effectiveStatus),
        sanitize(tierText),
        sanitize(idx.rule !== -1 ? row[idx.rule] : ''),
        sanitize(idx.usage !== -1 ? row[idx.usage] : '')
      ].join(','));
    }

    var blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'wiki-audit-report.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ── FORM SUBMIT ──────────────────────────────────────────────
  async function handleFormSubmit(e) {
    e.preventDefault();
    hideFormError();

    var sources = els.sourcesInput.value.trim();
    if (!sources) {
      showFormError('Please enter at least one source to evaluate.');
      els.sourcesInput.focus();
      return;
    }

    if (!getApiKey()) {
      showFormError('Gemini API key not configured. Click the "API Key: Not Set" badge in the nav bar to enter your key.');
      return;
    }

    setState('loading');

    try {
      var result = await auditSources(els.topicInput.value.trim(), sources);
      currentResult = result;
      renderResults(result);
      setState('results');
    } catch (err) {
      els.errorMessage.textContent = err.message || 'An unknown error occurred during the audit.';
      setState('error');
    }
  }

  // ── HTML ESCAPING ────────────────────────────────────────────
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttr(text) {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── EVENT DELEGATION ─────────────────────────────────────────
  function handleBodyClick(e) {
    // Copy Wiki-Ref buttons
    var copyBtn = e.target.closest('.btn-copy-ref');
    if (copyBtn) {
      e.preventDefault();
      handleCopyRef(copyBtn.dataset.url, copyBtn.dataset.row);
      return;
    }
  }

  // ── PASSWORD GATE ────────────────────────────────────────────
  var ACCESS_PASSWORD = 'demo2026';
  var AUTH_SESSION_KEY = 'wikiaudit_authed';

  function initAuthGate() {
    var gate = document.getElementById('authGate');
    var form = document.getElementById('authForm');
    var input = document.getElementById('authPassword');
    var error = document.getElementById('authError');

    if (!gate) return;

    // Already authenticated this session
    if (sessionStorage.getItem(AUTH_SESSION_KEY) === '1') {
      gate.classList.add('auth-gate--hidden');
      return;
    }

    gate.style.display = '';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (input.value === ACCESS_PASSWORD) {
        sessionStorage.setItem(AUTH_SESSION_KEY, '1');
        gate.classList.add('auth-gate--hidden');
        error.style.display = 'none';
      } else {
        error.style.display = '';
        input.value = '';
        input.focus();
      }
    });
  }

  // ── INITIALISATION ───────────────────────────────────────────
  function init() {
    initAuthGate();
    cacheDom();
    updateApiKeyBadge();
    setState('idle');

    // Bind events
    if (els.form) els.form.addEventListener('submit', handleFormSubmit);
    if (els.csvBtn) els.csvBtn.addEventListener('click', handleDownloadCSV);
    if (els.retryBtn) {
      els.retryBtn.addEventListener('click', function () {
        setState('idle');
      });
    }
    if (els.apiKeyBadge) {
      els.apiKeyBadge.addEventListener('click', promptForApiKey);
    }

    // Delegate clicks
    document.body.addEventListener('click', handleBodyClick);
  }

  document.addEventListener('DOMContentLoaded', init);

})();
