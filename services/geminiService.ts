import { GoogleGenAI } from "@google/genai";
import { BackupJob, Destination, Language } from "../types";

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateBackupScript = async (job: BackupJob, destinations: Destination[], lang: Language): Promise<string> => {
  const ai = getClient();
  if (!ai) return lang === 'pt' ? "# Chave API ausente. Configure process.env.GEMINI_API_KEY no .env.local" : "# API Key missing. Please configure process.env.GEMINI_API_KEY in .env.local";

  const languageName = lang === 'pt' ? 'Portuguese' : 'English';

  const destDetails = destinations
    .filter(d => job.destinationIds.includes(d.id))
    .map(d => `${d.type} (Name: ${d.name}, Path: ${d.pathOrBucket})`)
    .join(', ');

  const prompt = `
    You are a DevOps expert. Based on the following backup configuration, provide MULTIPLE script suggestions/strategies using different tools and languages.
    
    IMPORTANT: Responses (titles and explanations) MUST be in ${languageName}.
    
    For each suggestion, include:
    1. A Title (e.g., "Strategy 1: Native Bash & Rclone").
    2. A brief explanation of why this strategy is useful.
    3. The full script code.

    **Job Details:**
    - Name: ${job.name}
    - Source Type: ${job.sourceType}
    - Source Path: ${job.sourcePath}
    - Backup Type: ${job.backupType}
    - Destinations: ${destDetails}
    
    **Requirements for code:**
    - Include comments explaining the steps.
    - If it's a database, use the appropriate dump command.
    - If it's cloud storage, assume 'rclone' is configured with the name provided in destinations or use direct flags.
    - Handle rotation/cleanup if possible.
    - Output in clear Markdown blocks.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Error", error);
    return "# Error generating script. Please try again.";
  }
};
