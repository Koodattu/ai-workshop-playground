/**
 * AI Controller
 * Handles Gemini API integration for code generation
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config");
const { asyncHandler, AppError } = require("../middleware/errorHandler");

// Initialize Gemini AI client
const genAI = new GoogleGenerativeAI(config.geminiApiKey);

// System instruction for clean code output
const SYSTEM_INSTRUCTION = `You are an expert web developer assistant. Your task is to generate or modify clean, production-ready HTML, CSS, and JavaScript code.

Reply in the same language as the user, and SUPER shortly tell what you did. SUPER short.

CRITICAL OUTPUT RULES - FOLLOW EXACTLY:
1. Return code in the "code" field - absolutely NO markdown code fences, NO explanations
2. Return a SUPER short message in the "message" field in the SAME LANGUAGE as the user
3. The code field should contain ONLY the code itself - start directly with <!DOCTYPE html> or the first line of code
4. NO markdown code fences (no \`\`\`html, no \`\`\`, nothing) in the code field
5. The message should be 1-2 sentences maximum

CODE MODIFICATION RULES:
- If existing code is provided, modify/extend it based on the user's request
- Maintain the existing structure and style unless explicitly asked to change it
- If user says "add", "modify", "change", or "update" - work with the existing code
- If user wants something completely new, you can start fresh
- Preserve working functionality unless asked to remove it

CODE GENERATION RULES:
1. Generate complete, self-contained HTML files
2. Use inline <style> tags for CSS and inline <script> tags for JavaScript
3. Ensure code is production-ready and runs in any modern browser
4. Use modern, semantic HTML5
5. Create visually appealing designs with good styling
6. Include responsive design principles
7. Make interactive elements functional with proper JavaScript

REMEMBER: Return JSON with "message" (short, in user's language) and "code" (clean HTML/CSS/JS, no markdown).`;

// JSON schema for structured output
const CODE_GENERATION_SCHEMA = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "A very short response in the same language as the user describing what was done (1-2 sentences max)",
    },
    code: {
      type: "string",
      description: "The generated or modified HTML/CSS/JS code without any markdown formatting",
    },
  },
  required: ["message", "code"],
};

/**
 * Generate code using Gemini API with streaming structured outputs
 */
const generateCode = asyncHandler(async (req, res) => {
  const { prompt, existingCode, messageHistory } = req.body;

  if (!prompt) {
    throw new AppError("Prompt is required", 400);
  }

  if (!config.geminiApiKey) {
    throw new AppError("Gemini API key not configured", 500);
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let accumulatedText = "";
  let previousMessage = "";
  let previousCode = "";

  try {
    // Initialize the model with system instruction
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: CODE_GENERATION_SCHEMA,
      },
    });

    // Build the user prompt with context
    let userPrompt = "";

    // Add message history if provided
    if (messageHistory && Array.isArray(messageHistory) && messageHistory.length > 0) {
      userPrompt += "CONVERSATION HISTORY:\n";
      messageHistory.forEach((msg, index) => {
        const roleLabel = msg.role === "user" ? "USER" : "ASSISTANT";
        userPrompt += `${roleLabel}: ${msg.content}\n\n`;
      });
      userPrompt += "---\n\n";
    }

    // Add existing code if provided
    if (existingCode && existingCode.trim()) {
      userPrompt += `EXISTING CODE:
\`\`\`html
${existingCode}
\`\`\`

`;
    }

    // Add current prompt
    if (existingCode && existingCode.trim()) {
      userPrompt += `USER REQUEST: ${prompt}

Modify or extend the existing code based on the user's request.`;
    } else {
      userPrompt += prompt;
    }

    // Generate content with streaming
    const result = await model.generateContentStream(userPrompt);

    // Process the stream
    for await (const chunk of result.stream) {
      try {
        // Extract text from the chunk
        const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text;

        if (chunkText) {
          // Accumulate the text
          accumulatedText += chunkText;

          // Send the raw chunk event (fallback)
          const eventData = {
            type: "chunk",
            text: chunkText,
            accumulated: accumulatedText,
          };

          res.write(`data: ${JSON.stringify(eventData)}\n\n`);

          // Try to parse the accumulated JSON
          try {
            const parsed = JSON.parse(accumulatedText);

            // Extract message and code fields
            const currentMessage = parsed.message || "";
            const currentCode = parsed.code || "";

            // Send message-update event if message changed
            if (currentMessage && currentMessage !== previousMessage) {
              const messageEvent = {
                type: "message-update",
                message: currentMessage,
              };
              res.write(`data: ${JSON.stringify(messageEvent)}\n\n`);
              previousMessage = currentMessage;
            }

            // Send code-update event if code changed
            if (currentCode && currentCode !== previousCode) {
              const codeEvent = {
                type: "code-update",
                code: currentCode,
              };
              res.write(`data: ${JSON.stringify(codeEvent)}\n\n`);
              previousCode = currentCode;
            }
          } catch (parseError) {
            // JSON not complete yet, continue accumulating
            // This is expected during streaming
          }
        }
      } catch (chunkError) {
        console.error("Error processing chunk:", chunkError);
        // Continue processing other chunks
      }
    }

    // Parse the final accumulated JSON response
    let structuredResponse;
    try {
      structuredResponse = JSON.parse(accumulatedText);
    } catch (parseError) {
      throw new AppError("Failed to parse AI response", 500);
    }

    // Validate response has required fields
    if (!structuredResponse.code || !structuredResponse.message) {
      throw new AppError("Invalid AI response structure", 500);
    }

    // Send the final complete response
    const finalData = {
      type: "done",
      message: structuredResponse.message,
      code: structuredResponse.code,
      remaining: req.workshop?.remaining,
    };

    res.write(`data: ${JSON.stringify(finalData)}\n\n`);
    res.end();
  } catch (error) {
    // Handle specific Gemini API errors
    let errorMessage = "AI generation failed";
    let statusCode = 500;

    if (error.message?.includes("API key")) {
      errorMessage = "Invalid API configuration";
    } else if (error.message?.includes("quota")) {
      errorMessage = "API quota exceeded. Please try again later.";
      statusCode = 503;
    } else if (error.message?.includes("safety")) {
      errorMessage = "Request blocked due to safety filters";
      statusCode = 400;
    } else if (error instanceof AppError) {
      errorMessage = error.message;
      statusCode = error.statusCode;
    } else {
      errorMessage = `AI generation failed: ${error.message}`;
    }

    // Send error event
    const errorData = {
      type: "error",
      error: errorMessage,
      statusCode: statusCode,
    };

    res.write(`data: ${JSON.stringify(errorData)}\n\n`);
    res.end();
  }
});

module.exports = {
  generateCode,
};
