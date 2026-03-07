import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { Octokit } from '@octokit/rest';
import { DateTime } from 'luxon';
import { auth } from "../../../../auth";

// Initialize SDKs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const owner = process.env.GITHUB_USERNAME!;
const repo = process.env.GITHUB_REPO!;

// Helper function to fetch entire repository tree content for RAG context
async function fetchRepoContext(): Promise<string> {
  try {
    // 1. Get the default branch (usually main or master)
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    // 2. Get the tree recursively
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: "true",
    });

    // 3. Filter for markdown files
    const mdFiles = treeData.tree.filter(
      (node) => node.type === 'blob' && node.path?.endsWith('.md')
    );

    let fullContext = "=== REPOSITORY ARCHIVE ===\n\n";

    // 4. Fetch content for each file (in parallel to speed it up)
    const fileContents = await Promise.all(
      mdFiles.map(async (fileNode) => {
        try {
          const { data: blobData } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: fileNode.sha!,
          });
          const content = Buffer.from(blobData.content, 'base64').toString('utf-8');
          return `--- FILE: ${fileNode.path} ---\n${content}\n------------------------\n`;
        } catch (err) {
          console.warn(`Failed to fetch blob for ${fileNode.path}`);
          return "";
        }
      })
    );

    return fullContext + fileContents.join('\n');
  } catch (err) {
    console.error("Error fetching repo context:", err);
    return "Error fetching context. Proceeding blindly.";
  }
}

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

const SYSTEM_PROMPT_TEMPLATE = `
You are Antigravity, the archivist for the user's "Life OS" (Second Brain).
The user will give you a brain dump or ask you a question about their life.

If they are asking a question: Read the REPOSITORY ARCHIVE provided below and answer their question accurately. Return empty updates array.
If they are giving you a brain dump to save: Decide which markdown files need to be updated. If the thought doesn't fit anywhere neatly, put it in '00_Inbox/README.md'. Always append a timestamp to new content.

{{CONTEXT_HERE}}
`;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const allowedEmail = process.env.ALLOWED_EMAIL;

    if (!session || !session.user || session.user.email !== allowedEmail) {
       return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Fetch entire RAG context from Github
    const repoContext = await fetchRepoContext();
    const dynamicSystemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{{CONTEXT_HERE}}", repoContext);

    // 2. Send to Gemini
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: outputSchema,
        },
        systemInstruction: dynamicSystemPrompt
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
