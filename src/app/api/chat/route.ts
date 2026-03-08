import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { DateTime } from 'luxon';
import { auth } from "../../../../auth";
import dbConnect from "@/lib/mongoose";
import { UserDocument } from "@/lib/models";

// Initialize SDKs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Helper function to fetch all documents for a given user from MongoDB
async function fetchUserContext(userId: string): Promise<string> {
  try {
    await dbConnect();
    const documents = await UserDocument.find({ userId });

    if (!documents || documents.length === 0) {
      return "=== REPOSITORY ARCHIVE ===\n\n(No data found. This is a new user.)";
    }

    let fullContext = "=== REPOSITORY ARCHIVE ===\n\n";

    const fileContents = documents.map((doc) => {
      return `--- FILE: ${doc.category} ---\n${doc.content}\n------------------------\n`;
    });

    return fullContext + fileContents.join('\n');
  } catch (err) {
    console.error("Error fetching user context:", err);
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
            description: "The existing folder/category path (e.g., '03_Family_and_Relationships/Son.md') or a new path if it doesn't exist yet."
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
If they are giving you a brain dump to save: Decide which categories/files need to be updated. If the thought doesn't fit anywhere neatly, put it in '00_Inbox/README.md'. Always append a timestamp to new content.

Here is the recommended starting folder structure, but you can create others if needed:
00_Inbox/README.md
01_Identity_and_Growth/About_Me.md
01_Identity_and_Growth/Career_Master_Plan.md
01_Identity_and_Growth/Short_Term_Goals.md
01_Identity_and_Growth/Long_Term_Goals.md
02_Wealth_and_Finance/Financial_Strategy.md
02_Wealth_and_Finance/Income_and_Money_Making.md
02_Wealth_and_Finance/Investments_and_Portfolio.md
03_Family_and_Relationships/Son.md
03_Family_and_Relationships/Wife.md
03_Family_and_Relationships/Parents_and_Brother.md
04_Possessions_and_Assets/Vehicles.md
04_Possessions_and_Assets/Physical_Assets.md
05_Logs_and_Journals/Decision_Journal.md

{{CONTEXT_HERE}}
`;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    // Authenticate Multi-Tenant Session
    if (!session || !session.user || !session.user.id) {
       return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    const userId = session.user.id;
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Connect DB
    await dbConnect();

    // 1. Fetch entire RAG context from MongoDB for THIS specific user
    const userContext = await fetchUserContext(userId);
    const dynamicSystemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{{CONTEXT_HERE}}", userContext);

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

    // 3. Perform MongoDB Updates (Upserts)
    const appliedUpdates = [];
    
    for (const update of parsedData.updates) {
      const { filePath, contentToAppend } = update;

      // Find existing document
      const existingDoc = await UserDocument.findOne({ userId, category: filePath });
      let combinedContent = '';

      if (existingDoc) {
        combinedContent = `${existingDoc.content}\n\n### Update (${currentTime})\n${contentToAppend}`;
      } else {
        combinedContent = `# ${filePath.split('/').pop()?.replace('.md', '').replaceAll('_', ' ')}\n\n### Update (${currentTime})\n${contentToAppend}`;
      }

      // Upsert Document
      await UserDocument.findOneAndUpdate(
        { userId, category: filePath },
        { 
          $set: { content: combinedContent, updatedAt: new Date() } 
        },
        { upsert: true, new: true }
      );
      
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
