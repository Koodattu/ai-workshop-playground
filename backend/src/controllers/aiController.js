/**
 * AI Controller
 * Handles Gemini API integration for code generation
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { ERROR_CODES } = require("../constants/errorCodes");
const RequestLog = require("../models/RequestLog");
const Usage = require("../models/Usage");

// Gemini 2.0 Flash pricing (per token)
// Input: $0.10 per 1M tokens = $0.0000001 per token
// Output: $0.40 per 1M tokens = $0.0000004 per token
const GEMINI_PRICING = {
  inputPerToken: 0.0000001,
  outputPerToken: 0.0000004,
};

/**
 * Calculate estimated cost in cents based on token usage
 */
function calculateCostInCents(promptTokens, candidatesTokens) {
  const inputCost = promptTokens * GEMINI_PRICING.inputPerToken;
  const outputCost = candidatesTokens * GEMINI_PRICING.outputPerToken;
  const totalCostDollars = inputCost + outputCost;
  return totalCostDollars * 100; // Convert to cents
}

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
8. CRITICAL: Format code with proper indentation and newlines - each tag, style rule, and script line MUST be on its own line
9. Use proper line breaks (\n) to separate code lines - DO NOT return all code on a single line

REMEMBER: Return JSON with "message" (short, in user's language) and "code" (clean, PROPERLY FORMATTED HTML/CSS/JS with newlines, no markdown).`;

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
    throw new AppError("Prompt is required", 400, ERROR_CODES.PROMPT_REQUIRED);
  }

  if (!config.geminiApiKey) {
    throw new AppError("Gemini API key not configured", 500, ERROR_CODES.API_KEY_NOT_CONFIGURED);
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let accumulatedText = "";
  let previousMessage = "";
  let codeStarted = false;
  let codeBuffer = ""; // Buffer for incomplete lines
  let lastSentPosition = 0; // Track what we've already parsed and sent

  try {
    // Initialize the model with system instruction
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
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
    let streamResult = result; // Store for accessing response metadata after streaming

    // Process the stream
    for await (const chunk of result.stream) {
      try {
        // Extract text from the chunk
        const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text;

        if (chunkText) {
          // Accumulate the text
          accumulatedText += chunkText;

          // Efficient streaming parser - only look at new content
          // Instead of regex on full buffer, find code field boundaries once
          if (!codeStarted) {
            // Look for "code":"  pattern
            const codeStartIndex = accumulatedText.indexOf('"code"');
            if (codeStartIndex !== -1) {
              // Find the opening quote after "code":
              const afterColon = accumulatedText.indexOf(":", codeStartIndex + 6);
              if (afterColon !== -1) {
                const openQuote = accumulatedText.indexOf('"', afterColon);
                if (openQuote !== -1) {
                  codeStarted = true;
                  lastSentPosition = openQuote + 1; // Position after opening quote
                  res.write(`data: ${JSON.stringify({ type: "code-start" })}\n\n`);
                }
              }
            }
          }

          // If code has started, extract and send only new content
          if (codeStarted) {
            // Find the current end position (either closing quote or end of buffer)
            let currentEndPos = accumulatedText.length;

            // Look for closing quote (but not escaped ones)
            // Simple approach: find "} or ", pattern (end of code field)
            const closingPattern1 = accumulatedText.indexOf('"}', lastSentPosition);
            const closingPattern2 = accumulatedText.indexOf('",', lastSentPosition);

            if (closingPattern1 !== -1 || closingPattern2 !== -1) {
              // Code field is complete
              if (closingPattern1 !== -1) currentEndPos = closingPattern1;
              if (closingPattern2 !== -1 && closingPattern2 < currentEndPos) currentEndPos = closingPattern2;
            }

            // Extract only NEW content since last send
            if (currentEndPos > lastSentPosition) {
              const newContent = accumulatedText.substring(lastSentPosition, currentEndPos);

              // Decode JSON escape sequences
              const decodedContent = newContent.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");

              // Debug: Log if newlines are present
              if (decodedContent.includes("\n")) {
                console.log(`[Stream] Decoded chunk with ${decodedContent.split("\n").length - 1} newlines`);
              } else {
                console.log(`[Stream] WARNING: Decoded chunk has NO newlines (${decodedContent.length} chars)`);
              }

              // Add to buffer
              codeBuffer += decodedContent;

              // Send only complete lines (ending with \n)
              const lines = codeBuffer.split("\n");

              // If buffer ends with \n, all lines are complete
              // If not, keep the last incomplete line in buffer
              const hasTrailingNewline = codeBuffer.endsWith("\n");
              const completeLines = hasTrailingNewline ? lines : lines.slice(0, -1);

              if (completeLines.length > 0) {
                // Send complete lines (with newlines preserved)
                const linesToSend = completeLines.join("\n") + (completeLines.length > 0 ? "\n" : "");
                res.write(`data: ${JSON.stringify({ type: "code-chunk", chunk: linesToSend })}\n\n`);

                // Update buffer to keep only incomplete line
                codeBuffer = hasTrailingNewline ? "" : lines[lines.length - 1];
              }

              lastSentPosition = currentEndPos;
            }
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
      throw new AppError("Failed to parse AI response", 500, ERROR_CODES.AI_RESPONSE_PARSE_FAILED);
    }

    // Validate response has required fields
    if (!structuredResponse.code || !structuredResponse.message) {
      throw new AppError("Invalid AI response structure", 500, ERROR_CODES.AI_RESPONSE_INVALID);
    }

    // Send code-complete event (code field is now complete)
    if (codeStarted) {
      // Send any remaining incomplete line from buffer
      if (codeBuffer.length > 0) {
        res.write(`data: ${JSON.stringify({ type: "code-chunk", chunk: codeBuffer })}\n\n`);
        codeBuffer = "";
      }

      res.write(`data: ${JSON.stringify({ type: "code-complete" })}\n\n`);
    }

    // Send message-complete event (message field is complete)
    const finalMessage = structuredResponse.message;
    res.write(`data: ${JSON.stringify({ type: "message-complete", message: finalMessage })}\n\n`);

    // Get token usage metadata from the aggregated response
    try {
      const aggregatedResponse = await streamResult.response;
      const usageMetadata = aggregatedResponse.usageMetadata || {};

      // Extract token counts with fallbacks
      const promptTokens = usageMetadata.promptTokenCount || 0;
      const candidatesTokens = usageMetadata.candidatesTokenCount || 0;
      const thoughtsTokens = usageMetadata.thoughtsTokenCount || 0;
      const cachedTokens = usageMetadata.cachedContentTokenCount || 0;
      const totalTokens = usageMetadata.totalTokenCount || promptTokens + candidatesTokens;

      // Calculate estimated cost in cents
      const estimatedCost = calculateCostInCents(promptTokens, candidatesTokens);

      console.log(
        `[Token Usage] Prompt: ${promptTokens}, Candidates: ${candidatesTokens}, Thoughts: ${thoughtsTokens}, Total: ${totalTokens}, Cost: ${estimatedCost.toFixed(6)} cents`,
      );

      // Log request to RequestLog and update Usage if we have usage data from workshopGuard
      if (req.workshop && req.workshop.passwordId && req.workshop.visitorId) {
        const tokenData = {
          promptTokens,
          candidatesTokens,
          thoughtsTokens,
          totalTokens,
          estimatedCost,
        };

        // Log the request details
        await RequestLog.logRequest({
          passwordId: req.workshop.passwordId,
          visitorId: req.workshop.visitorId,
          promptTokens,
          candidatesTokens,
          thoughtsTokens,
          cachedTokens,
          totalTokens,
          estimatedCost,
          model: "gemini-2.5-flash",
          generationType: "code-generation",
        });

        // Update aggregate usage tracking
        await Usage.trackTokenUsage(req.workshop.passwordId, req.workshop.visitorId, tokenData);

        console.log(`[Token Tracking] Logged request for visitor ${req.workshop.visitorId}`);
      }
    } catch (tokenError) {
      // Log the error but don't fail the request - token tracking is non-critical
      console.error("[Token Tracking Error] Failed to log token usage:", tokenError.message);
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
    let errorCode = ERROR_CODES.AI_GENERATION_FAILED;

    if (error.message?.includes("API key")) {
      errorMessage = "Invalid API configuration";
      errorCode = ERROR_CODES.API_KEY_INVALID;
    } else if (error.message?.includes("quota")) {
      errorMessage = "API quota exceeded. Please try again later.";
      statusCode = 503;
      errorCode = ERROR_CODES.API_QUOTA_EXCEEDED;
    } else if (error.message?.includes("safety")) {
      errorMessage = "Request blocked due to safety filters";
      statusCode = 400;
      errorCode = ERROR_CODES.SAFETY_FILTER_BLOCKED;
    } else if (error instanceof AppError) {
      errorMessage = error.message;
      statusCode = error.statusCode;
      errorCode = error.errorCode || ERROR_CODES.AI_GENERATION_FAILED;
    } else {
      errorMessage = `AI generation failed: ${error.message}`;
    }

    // Send error event
    const errorData = {
      type: "error",
      error: errorMessage,
      errorCode: errorCode,
      statusCode: statusCode,
    };

    res.write(`data: ${JSON.stringify(errorData)}\n\n`);
    res.end();
  }
});

module.exports = {
  generateCode,
};
