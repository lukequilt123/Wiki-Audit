/* ============================================================
   WikiAudit — Application Logic
   Vanilla JS — no dependencies
   ============================================================ */

(function () {
  'use strict';

  // ── CONFIGURATION ────────────────────────────────────────────
  const GEMINI_MODEL = 'gemini-2.5-flash';
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
  const PROXY_URL = 'https://wikiaudit-proxy.luke-bcf.workers.dev';

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
      contextUrlInput: document.getElementById('contextUrlInput'),
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
      els.apiKeyBadge.textContent = 'Using Proxy';
      els.apiKeyBadge.style.background = 'rgba(139, 92, 246, 0.15)';
      els.apiKeyBadge.style.borderColor = 'rgba(139, 92, 246, 0.3)';
      els.apiKeyBadge.style.color = '#a78bfa';
      els.apiKeyBadge.style.cursor = 'pointer';
      els.apiKeyBadge.title = 'Using server proxy. Click to enter your own API key instead.';
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
    if (els.contextUrlInput) els.contextUrlInput.disabled = isLoading;
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

  // ── CONTEXT URL CLASSIFICATION ──────────────────────────────
  function classifyContextUrl(url) {
    if (!url) return null;
    try {
      var parsed = new URL(url);
      var host = parsed.hostname.toLowerCase();
      if (host.endsWith('.wikipedia.org') && parsed.pathname.startsWith('/wiki/')) {
        return { type: 'wikipedia', url: url };
      }
      return { type: 'website', url: url };
    } catch (e) {
      return { type: 'website', url: url };
    }
  }

  // ── GEMINI API CALL ──────────────────────────────────────────
  var BATCH_SIZE = 5; // Max sources per API call to avoid token exhaustion

  function buildContextBlock(contextUrl) {
    var context = classifyContextUrl(contextUrl);
    if (!context) return '';
    if (context.type === 'wikipedia') {
      return [
        '',
        '**Existing Wikipedia Article:** ' + context.url,
        'Use your Google Search tool to review this Wikipedia article. Assess how each source below relates to the existing article content, and whether it adds value or duplicates existing references.',
        ''
      ].join('\n');
    }
    return [
      '',
      '**Subject Context URL:** ' + context.url,
      'Use your Google Search tool to review this website. Use the context about this subject/organization to better assess the relevance and reliability of the sources below.',
      ''
    ].join('\n');
  }

  var MAX_RETRIES = 2;

  async function callGemini(promptText, attempt) {
    attempt = attempt || 0;
    var apiKey = getApiKey();
    var useProxy = !apiKey;

    var body = {
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: [{
        parts: [{ text: promptText }]
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192
      },
      tools: [{
        google_search: {}
      }]
    };

    var url, response;

    if (useProxy) {
      body.model = GEMINI_MODEL;
      response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } else {
      url = GEMINI_API_URL + '/' + GEMINI_MODEL + ':generateContent?key=' + apiKey;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }

    if (!response.ok) {
      var errData;
      try { errData = await response.json(); } catch (e) { errData = {}; }
      var errMsg = (errData.error && errData.error.message) || ('API request failed with status ' + response.status);
      throw new Error(errMsg);
    }

    var data = await response.json();
    var text = '';
    var groundingChunks = [];

    // Check for prompt-level blocks
    if (data.promptFeedback && data.promptFeedback.blockReason) {
      throw new Error('Request blocked by safety filter: ' + data.promptFeedback.blockReason);
    }

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response candidates received from Gemini. The request may have been filtered.');
    }

    var candidate = data.candidates[0];

    // Check finish reason for problems
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Response blocked by Gemini safety filter.');
    }
    if (candidate.finishReason === 'RECITATION') {
      throw new Error('Response blocked due to recitation policy.');
    }
    if (candidate.finishReason === 'MAX_TOKENS') {
      console.warn('Gemini response was truncated (MAX_TOKENS). Results may be incomplete.');
    }

    if (candidate.content && candidate.content.parts) {
      // Filter: only text parts, exclude "thought" parts (Gemini 2.5 thinking)
      var textParts = candidate.content.parts.filter(function (p) {
        return typeof p.text === 'string' && !p.thought;
      });
      text = textParts.map(function (p) { return p.text; }).join('');

      // If no non-thought text, fall back to all text parts
      if (!text.trim()) {
        var allText = candidate.content.parts
          .filter(function (p) { return typeof p.text === 'string'; })
          .map(function (p) { return p.text; }).join('');
        if (allText.trim()) {
          console.warn('Only thought-text found, using it as fallback.');
          text = allText;
        }
      }
    }

    if (candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) {
      groundingChunks = candidate.groundingMetadata.groundingChunks;
    }

    if (!text.trim()) {
      if (attempt < MAX_RETRIES) {
        console.warn('Gemini returned empty text (attempt ' + (attempt + 1) + '/' + (MAX_RETRIES + 1) + '). Retrying after delay...');
        await new Promise(function (r) { setTimeout(r, 1500 * (attempt + 1)); });
        return callGemini(promptText, attempt + 1);
      }
      var partTypes = (candidate.content && candidate.content.parts || [])
        .map(function (p) { return Object.keys(p).join(','); });
      throw new Error(
        'Gemini returned empty text after ' + (MAX_RETRIES + 1) + ' attempts. Part types: [' + partTypes.join('; ') +
        ']. Finish reason: ' + (candidate.finishReason || 'unknown') +
        '. Try reducing the number of sources.'
      );
    }

    console.log('Gemini output length:', text.length);

    return { text: text, groundingChunks: groundingChunks };
  }

  async function auditSources(topic, contextUrl, sources) {
    var contextBlock = buildContextBlock(contextUrl);

    // Split sources into lines, filter blanks
    var sourceLines = sources.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);

    // If small enough, do a single request
    if (sourceLines.length <= BATCH_SIZE) {
      var prompt = [
        '**Audit Request:**',
        '',
        '**Subject/Article Topic:** ' + (topic || 'Not specified (General Audit)'),
        contextBlock,
        '**Sources to Audit:**',
        sourceLines.join('\n'),
        '',
        'CRITICAL: Output ONLY the Markdown Table. Do not write any introductory summary, preamble, or conclusion text. Start the response immediately with the markdown header row.'
      ].join('\n');

      var result = await callGemini(prompt);
      return {
        markdownTable: result.text,
        rawText: result.text,
        groundingChunks: result.groundingChunks
      };
    }

    // Batch processing for large lists
    var batches = [];
    for (var i = 0; i < sourceLines.length; i += BATCH_SIZE) {
      batches.push(sourceLines.slice(i, i + BATCH_SIZE));
    }

    var allTableRows = [];
    var allGrounding = [];
    var headerLine = '';
    var separatorLine = '';

    for (var b = 0; b < batches.length; b++) {
      // Update loading text with batch progress
      var loadingText = document.querySelector('.state-text');
      if (loadingText) {
        loadingText.textContent = 'Analysing sources — batch ' + (b + 1) + ' of ' + batches.length + '...';
      }

      var batchPrompt = [
        '**Audit Request (Batch ' + (b + 1) + ' of ' + batches.length + '):**',
        '',
        '**Subject/Article Topic:** ' + (topic || 'Not specified (General Audit)'),
        contextBlock,
        '**Sources to Audit:**',
        batches[b].join('\n'),
        '',
        'CRITICAL: Output ONLY the Markdown Table. Do not write any introductory summary, preamble, or conclusion text. Start the response immediately with the markdown header row.'
      ].join('\n');

      var batchResult;
      try {
        batchResult = await callGemini(batchPrompt);
      } catch (batchErr) {
        console.error('Batch ' + (b + 1) + ' failed: ' + batchErr.message);
        // Add error rows for each source in this batch so they still appear
        for (var ei = 0; ei < batches[b].length; ei++) {
          allTableRows.push('| ' + batches[b][ei] + ' | ⚠️ CAUTION | — | API Error | Batch failed — re-run audit to retry |');
        }
        continue;
      }
      allGrounding = allGrounding.concat(batchResult.groundingChunks || []);

      // Parse the batch table and extract rows
      var batchTable = extractMarkdownTable(batchResult.text);
      var batchParsed = parseTableRows(batchTable);
      if (batchParsed) {
        if (!headerLine) {
          // Capture header and separator from first batch
          var batchLines = batchTable.split('\n');
          for (var li = 0; li < batchLines.length; li++) {
            var ln = batchLines[li].trim();
            if (ln.includes('|') && (ln.toLowerCase().includes('source') || ln.toLowerCase().includes('url'))) {
              headerLine = ln;
              // Next line should be separator
              if (li + 1 < batchLines.length && /^[|\s\-:]+$/.test(batchLines[li + 1].trim())) {
                separatorLine = batchLines[li + 1].trim();
              }
              break;
            }
          }
        }
        // Collect data rows from parsed result (avoids fragile header-detection filters)
        var batchDataLines = batchTable.split('\n');
        // Find where data rows start: skip header and separator
        var dataStartIndex = 0;
        for (var di = 0; di < batchDataLines.length; di++) {
          var dl = batchDataLines[di].trim();
          if (/^[|\s\-:]+$/.test(dl)) {
            dataStartIndex = di + 1; // data starts after separator
            break;
          }
        }
        for (var ri = dataStartIndex; ri < batchDataLines.length; ri++) {
          var row = batchDataLines[ri].trim();
          if (row.includes('|') && !/^[|\s\-:]+$/.test(row)) {
            allTableRows.push(row);
          }
        }
        console.log('Batch ' + (b + 1) + ': collected ' + (allTableRows.length) + ' total rows so far');
      } else {
        // Batch didn't parse into a table — append raw text as fallback
        console.warn('Batch ' + (b + 1) + ' did not return a parseable table.');
        for (var fi = 0; fi < batches[b].length; fi++) {
          allTableRows.push('| ' + batches[b][fi] + ' | ⚠️ CAUTION | — | Parse Error | Response unparseable — re-run audit to retry |');
        }
      }
    }

    // Reassemble combined table — use default header if none captured (e.g. first batch failed)
    if (!headerLine) {
      headerLine = '| Source/URL | Reliability Status | Tier Classification | Policy Flags | Action |';
    }
    var combinedTable = headerLine + '\n' +
      (separatorLine || '|---|---|---|---|---|') + '\n' +
      allTableRows.join('\n');

    return {
      markdownTable: combinedTable,
      rawText: combinedTable,
      groundingChunks: allGrounding
    };
  }

  // ── MARKDOWN TABLE PARSING ───────────────────────────────────
  function stripCodeFences(text) {
    // Remove ```markdown ... ``` or ``` ... ``` wrappers
    return text.replace(/```(?:markdown|md)?\s*\n([\s\S]*?)```/g, '$1');
  }

  function extractMarkdownTable(text) {
    if (!text) return '';
    text = stripCodeFences(text);
    var lines = text.split('\n');
    var tableLines = [];
    var insideTable = false;

    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      var lower = trimmed.toLowerCase();

      // Detect header row: must contain | and a source/url keyword
      if (!insideTable && trimmed.includes('|') && (lower.includes('source') || lower.includes('url'))) {
        insideTable = true;
        tableLines.push(trimmed);
        continue;
      }
      if (insideTable) {
        if (trimmed.startsWith('|') || /^[|\s\-:]+$/.test(trimmed)) {
          tableLines.push(trimmed);
        } else if (trimmed === '') {
          // Skip blank lines within the table — don't break
          continue;
        } else {
          // Non-table line: check if more table rows follow (Gemini sometimes
          // inserts a note line between rows). Look ahead up to 3 lines.
          var resumedTable = false;
          for (var k = i + 1; k < Math.min(i + 4, lines.length); k++) {
            if (lines[k].trim().startsWith('|')) {
              resumedTable = true;
              break;
            }
          }
          if (resumedTable) {
            continue; // skip the stray line, keep collecting
          }
          break;
        }
      }
    }

    return tableLines.length === 0 ? text : tableLines.join('\n');
  }

  function splitTableRow(line) {
    // Split on | but respect markdown links [text](url) which may contain |
    var cells = [];
    var current = '';
    var inBracket = 0;
    var inParen = 0;

    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '[') inBracket++;
      else if (ch === ']') inBracket = Math.max(0, inBracket - 1);
      else if (ch === '(') inParen++;
      else if (ch === ')') inParen = Math.max(0, inParen - 1);
      else if (ch === '|' && inBracket === 0 && inParen === 0) {
        cells.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    cells.push(current.trim());

    // Remove leading/trailing empty cells from pipe borders
    if (cells.length > 0 && cells[0] === '') cells.shift();
    if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
    return cells;
  }

  function parseTableRows(markdown) {
    markdown = stripCodeFences(markdown);
    var lines = markdown.trim().split('\n').filter(function (l) { return l.trim().length > 0; });
    var headerIndex = -1;

    for (var i = 0; i < lines.length; i++) {
      if (lines[i].includes('|') && (lines[i].toLowerCase().includes('source') || lines[i].toLowerCase().includes('url'))) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) return null;

    var headers = splitTableRow(lines[headerIndex]);

    var rows = [];
    for (var j = headerIndex + 1; j < lines.length; j++) {
      var line = lines[j].trim();
      if (!line.includes('|') || /^[|\s\-:]+$/.test(line)) continue;

      var cells = splitTableRow(line);
      // Only add rows that have a reasonable number of cells
      if (cells.length >= 2) {
        rows.push(cells);
      }
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
      // Show raw fallback with debug info
      console.warn('Table parsing failed. Raw text length:', (data.rawText || '').length);
      console.warn('Extracted markdown:', markdown);
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
  // ── DISCLAIMER MODAL ─────────────────────────────────────────
  var disclaimerModal = null;
  var disclaimerProceedBtn = null;
  var disclaimerCancelBtn = null;
  var pendingSubmit = false;

  function showDisclaimer() {
    if (disclaimerModal) disclaimerModal.classList.remove('disclaimer--hidden');
  }

  function hideDisclaimer() {
    if (disclaimerModal) disclaimerModal.classList.add('disclaimer--hidden');
  }

  async function runAudit() {
    setState('loading');

    var contextUrl = els.contextUrlInput ? els.contextUrlInput.value.trim() : '';

    try {
      var result = await auditSources(els.topicInput.value.trim(), contextUrl, els.sourcesInput.value.trim());
      currentResult = result;
      renderResults(result);
      setState('results');
    } catch (err) {
      els.errorMessage.textContent = err.message || 'An unknown error occurred during the audit.';
      setState('error');
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    hideFormError();

    var sources = els.sourcesInput.value.trim();
    if (!sources) {
      showFormError('Please enter at least one source to evaluate.');
      els.sourcesInput.focus();
      return;
    }

    // Validate context URL if provided
    var contextUrl = els.contextUrlInput ? els.contextUrlInput.value.trim() : '';
    if (contextUrl && !contextUrl.match(/^https?:\/\/.+/)) {
      showFormError('Context URL must start with http:// or https://');
      els.contextUrlInput.focus();
      return;
    }

    // Show disclaimer modal instead of running immediately
    showDisclaimer();
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

    // Disclaimer modal
    disclaimerModal = document.getElementById('disclaimerModal');
    disclaimerProceedBtn = document.getElementById('disclaimerProceed');
    disclaimerCancelBtn = document.getElementById('disclaimerCancel');

    if (disclaimerProceedBtn) {
      disclaimerProceedBtn.addEventListener('click', function () {
        hideDisclaimer();
        runAudit();
      });
    }
    if (disclaimerCancelBtn) {
      disclaimerCancelBtn.addEventListener('click', hideDisclaimer);
    }

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
