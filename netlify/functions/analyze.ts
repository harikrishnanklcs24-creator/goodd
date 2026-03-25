import { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { text } = JSON.parse(event.body || '{}');

    if (!text) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing paper content (text)" }) };
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("Missing GEMINI_API_KEY environment variable");
      return { statusCode: 500, body: JSON.stringify({ error: "Server configuration error" }) };
    }

    const prompt = `
      You are an expert IEEE Paper Reviewer and Plagiarism Detection Engine.
      Analyze the following IEEE research paper text strictly according to IEEE PSPB (Publication Services and Products Board) levels and thresholds.
      
      IEEE ACCEPTABLE THRESHOLDS:
      - < 15%: SAFE (Accepted, no further review).
      - 15% – 30%: WARNING (Manual review required; revision likely).
      - > 30%: HIGH RISK (Desk rejection likely).
      - CRITICAL FLAG: Any single source similarity > 10% (even if total is low).

      IEEE FIVE LEVELS OF PLAGIARISM (PSPB):
      - Level 1 (50%–100%): Verbatim copying of a major part or entire paper. Action: Immediate rejection and multi-year ban.
      - Level 2 (20%–50%): Copying large sections without proper citation. Action: Rejection and possible 1-3 year ban.
      - Level 3 (< 20%): Copying short paragraphs or sentences without citation. Action: Likely rejection or required major revision.
      - Level 4: Improper paraphrasing (changing only a few words while keeping structure). Action: Warning or rejection.
      - Level 5: Proper citation used, but delineation between your work and source is unclear. Action: Minor revision required.

      KEY EXCEPTIONS (DO NOT FLAG AS PLAGIARISM):
      - Standard Terminology: Common technical phrases, mathematical formulas, equipment descriptions.
      - Exclusions: Bibliography/References section.
      - Self-Plagiarism Note: If reusing own conference work for a journal, check if there is ~30% new content and citation.

      Return a JSON object following this schema:
      {
        "overall": {
          "similarity": number (0-100),
          "aiUsagePercentage": number (0-100),
          "humanizedPercentage": number (0-100),
          "status": "Safe" | "Warning" | "High Risk",
          "severityLevel": number (1-5),
          "severityTitle": string (e.g., "Level 1: Extreme Verbatim"),
          "severityExplanation": string,
          "recommendedAction": string (The specific IEEE action for this level)
        },
        "sections": [
          { "name": string, "similarity": number, "content": "brief summary" }
        ],
        "sources": [
          { "name": string, "similarity": number, "url": string, "isCritical": boolean }
        ],
        "flaggedContent": [
          { 
            "text": "snippet", 
            "type": "Direct Copying" | "Poor Paraphrasing" | "Missing Citation" | "Repeated Content" | "Common Technical Phrase" | "Self-Plagiarism",
            "explanation": "why this is an issue",
            "severity": "Low" | "Medium" | "High"
          }
        ],
        "issues": [string],
        "insights": {
          "mostPlagiarizedSection": string,
          "acceptanceRisk": string,
          "selfPlagiarismNote": string
        },
        "recommendations": [string]
      }

      Paper Content:
      ${text}
    `;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text || '{}');
    
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error("Error from Gemini API:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message || 'Analysis failed.' })
    };
  }
};
