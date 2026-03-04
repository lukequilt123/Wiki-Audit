import { GoogleGenAI } from "@google/genai";
import { AuditResult, GroundingChunk } from "../types";

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

export const auditSources = async (topic: string, sources: string): Promise<AuditResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    **Audit Request:**
    
    **Subject/Article Topic:** ${topic || "Not specified (General Audit)"}
    
    **Sources to Audit:**
    ${sources}
    
    CRITICAL: Output ONLY the Markdown Table. Do not write any introductory summary, preamble, or conclusion text. Start the response immediately with the markdown header.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    
    // Debug log for troubleshooting formatting issues
    console.log("Raw Gemini Output:", text);
    
    const groundingChunks: GroundingChunk[] = 
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return {
      markdownTable: text,
      rawText: text,
      groundingChunks: groundingChunks,
    };
  } catch (error: any) {
    console.error("Gemini Audit Error:", error);
    throw new Error(error.message || "Failed to audit sources.");
  }
};