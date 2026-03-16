import { GoogleGenAI } from "@google/genai";
import { BackupJob, Destination } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateBackupScript = async (job: BackupJob, destinations: Destination[]): Promise<string> => {
  const ai = getClient();
  if (!ai) return "# API Key missing. Please configure process.env.API_KEY";

  const destDetails = destinations
    .filter(d => job.destinationIds.includes(d.id))
    .map(d => `${d.type} (Name: ${d.name}, Path: ${d.pathOrBucket})`)
    .join(', ');

  const prompt = `
    You are a DevOps expert. Generate a shell script (using standard tools like rsync, mysqldump, pg_dump, or rclone as appropriate) for the following backup configuration.
    
    **Job Details:**
    - Name: ${job.name}
    - Source Type: ${job.sourceType}
    - Source Path: ${job.sourcePath}
    - Backup Type: ${job.backupType}
    - Destinations: ${destDetails}
    
    **Requirements:**
    - Include comments explaining the steps.
    - If it's a database, use the appropriate dump command.
    - If it's cloud storage, assume 'rclone' is configured with the name provided in destinations.
    - Handle rotation if possible based on backup type.
    - Output ONLY the bash script code.
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
