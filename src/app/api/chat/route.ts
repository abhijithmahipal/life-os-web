import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { Octokit } from '@octokit/rest';
import { DateTime } from 'luxon';

// Initialize SDKs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const owner = process.env.GITHUB_USERNAME!;
const repo = process.env.GITHUB_REPO!;

// Define the response schema we expect from Gemini
const outputSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    updates: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          filePath: {
            type: SchemaType.STRING,
            description: "The existing markdown file path (e.g., '03_Family_and_Relationships/Son.md') or a new file path if it doesn't exist yet."
          },
          contentToAppend: {
            type: SchemaType.STRING,
            description: "The new markdown text to append to the file. Format it cleanly with bullets or headers if needed."
          }
        },
        required: ["filePath", "contentToAppend"]
      }
    },
    systemSummary: {
      type: SchemaType.STRING,
      description: "A friendly response summary to show the user what you just did."
    }
  },
  required: ["updates", "systemSummary"]
};

const SYSTEM_PROMPT = `
You are Antigravity, the archivist for the user's "Life OS" (Second Brain).
The user is going to give you a brain dump. It may contain multiple unrelated topics.
Your job is to analyze their input and decide which markdown files in their Life OS repository need to be updated.

Here is the current folder structure of their Life OS:

00_Inbox/README.md
01_Identity_and_Growth/About_Me.md
01_Identity_and_Growth/Career_Master_Plan.md
01_Identity_and_Growth/Short_Term_Goals.md
01_Identity_and_Growth/Long_Term_Goals.md
01_Identity_and_Growth/Learning_Pathways.md
02_Wealth_and_Finance/Financial_Strategy.md
02_Wealth_and_Finance/Income_and_Money_Making.md
02_Wealth_and_Finance/Investments_and_Portfolio.md
03_Family_and_Relationships/Son.md
03_Family_and_Relationships/Wife.md
03_Family_and_Relationships/Parents_and_Brother.md
03_Family_and_Relationships/Circle_of_Influence.md
04_Possessions_and_Assets/Vehicles.md
04_Possessions_and_Assets/Physical_Assets.md
05_Logs_and_Journals/Decision_Journal.md

If the user's thought doesn't fit anywhere neatly, put it in '00_Inbox/README.md'.
Always append a timestamp to the new content so the user knows when they said it.
`;

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Send to Gemini
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: outputSchema,
        },
        systemInstruction: SYSTEM_PROMPT
    });

    const result = await model.generateContent(message);
    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    const currentTime = DateTime.now().toFormat('yyyy-MM-dd HH:mm');

    // 2. Perform GitHub Updates
    const appliedUpdates = [];
    
    for (const update of parsedData.updates) {
      const { filePath, contentToAppend } = update;
      let currentContent = '';
      let fileSha = undefined;

      // Try to get existing file
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: filePath,
        });

        if (!Array.isArray(data) && data.type === 'file') {
          currentContent = Buffer.from(data.content, 'base64').toString('utf-8');
          fileSha = data.sha;
        }
      } catch (err: any) {
        // File might not exist (404), which is fine, we will create it.
        if (err.status !== 404) {
             console.log("GitHub API Error getting file:", err);
        }
      }

      const combinedContent = currentContent 
        ? `${currentContent}\n\n### Update (${currentTime})\n${contentToAppend}`
        : `# ${filePath.split('/').pop()?.replace('.md', '').replaceAll('_', ' ')}\n\n### Update (${currentTime})\n${contentToAppend}`;

      // Write changes
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: `Life OS Update: Updated ${filePath} via Antigravity`,
        content: Buffer.from(combinedContent).toString('base64'),
        sha: fileSha,
      });
      
      appliedUpdates.push(filePath);
    }

    return NextResponse.json({ 
        success: true, 
        summary: parsedData.systemSummary,
        filesModified: appliedUpdates 
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
