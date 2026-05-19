/**
 * AI Controller
 * Handles Gemini API integration for code generation
 */

const { GoogleGenAI, ThinkingLevel } = require("@google/genai");
const config = require("../config");
const { asyncHandler, AppError } = require("../middleware/errorHandler");
const { ERROR_CODES } = require("../constants/errorCodes");
const RequestLog = require("../models/RequestLog");
const Usage = require("../models/Usage");

const MODEL_PREFERENCES = {
  fast: {
    model: "gemini-2.5-flash",
    pricing: {
      inputPerToken: 0.0000003,
      outputPerToken: 0.0000025,
    },
    thinkingConfig: {
      thinkingBudget: 0,
    },
  },
  balanced: {
    model: "gemini-3-flash-preview",
    pricing: {
      inputPerToken: 0.0000005,
      outputPerToken: 0.000003,
    },
  },
  accurate: {
    model: "gemini-3.5-flash",
    pricing: {
      inputPerToken: 0.0000015,
      outputPerToken: 0.000009,
    },
  },
};

const DEFAULT_MODEL_PREFERENCE = "balanced";

const GEMINI_THINKING_LEVELS = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/**
 * Calculate estimated cost in cents based on token usage
 */
function calculateCostInCents(promptTokens, billableOutputTokens, pricing) {
  const inputCost = promptTokens * pricing.inputPerToken;
  const outputCost = billableOutputTokens * pricing.outputPerToken;
  const totalCostDollars = inputCost + outputCost;
  return totalCostDollars * 100; // Convert to cents
}

function getModelPreference(modelPreference) {
  return MODEL_PREFERENCES[modelPreference] || MODEL_PREFERENCES[DEFAULT_MODEL_PREFERENCE];
}

function getGeminiThinkingLevel() {
  const normalizedLevel = (config.geminiThinkingLevel || "low").toLowerCase();
  return GEMINI_THINKING_LEVELS[normalizedLevel] || ThinkingLevel.LOW;
}

/**
 * JSON String Stream Decoder
 *
 * Correctly decodes escape sequences from a streaming JSON string value.
 * Handles:
 * - Partial escape sequences across chunk boundaries
 * - Nested escapes (\\n → \n literal, not newline)
 * - Unicode escapes (\uXXXX)
 * - Proper string termination detection
 */
function createJsonStringDecoder() {
  let pendingEscape = ""; // Holds incomplete escape sequence
  let isComplete = false; // True when closing quote found

  // Escape sequence mapping per RFC 8259
  const escapeMap = {
    n: "\n",
    t: "\t",
    r: "\r",
    '"': '"',
    "\\": "\\",
    "/": "/",
    b: "\b",
    f: "\f",
  };

  /**
   * Decode a chunk of JSON string content (after the opening quote)
   * @param {string} chunk - Raw JSON string content (may contain escape sequences)
   * @returns {{ decoded: string, done: boolean, remaining: string }}
   */
  function decode(chunk) {
    if (isComplete) {
      return { decoded: "", done: true, remaining: chunk };
    }

    let decoded = "";
    let i = 0;
    const input = pendingEscape + chunk;
    pendingEscape = "";

    while (i < input.length) {
      const char = input[i];

      if (char === "\\") {
        // Check if we have the next character
        if (i + 1 >= input.length) {
          // Escape sequence incomplete - save for next chunk
          pendingEscape = "\\";
          break;
        }

        const nextChar = input[i + 1];

        // Handle unicode escape \uXXXX
        if (nextChar === "u") {
          if (i + 5 >= input.length) {
            // Unicode sequence incomplete - save for next chunk
            pendingEscape = input.substring(i);
            break;
          }
          // Parse the 4 hex digits
          const hex = input.substring(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            decoded += String.fromCharCode(parseInt(hex, 16));
            i += 6;
          } else {
            // Invalid unicode escape - pass through as-is
            decoded += "\\u";
            i += 2;
          }
          continue;
        }

        // Handle standard escapes
        if (Object.prototype.hasOwnProperty.call(escapeMap, nextChar)) {
          decoded += escapeMap[nextChar];
        } else {
          // Unknown escape - pass through (shouldn't happen in valid JSON)
          decoded += nextChar;
        }
        i += 2;
      } else if (char === '"') {
        // Unescaped quote = end of string
        isComplete = true;
        return {
          decoded,
          done: true,
          remaining: input.substring(i + 1),
        };
      } else {
        // Normal character
        decoded += char;
        i++;
      }
    }

    return {
      decoded,
      done: false,
      remaining: "",
    };
  }

  /**
   * Check if there's a pending incomplete escape sequence
   */
  function hasPending() {
    return pendingEscape.length > 0;
  }

  /**
   * Reset the decoder state
   */
  function reset() {
    pendingEscape = "";
    isComplete = false;
  }

  return { decode, hasPending, reset };
}

// Initialize Gemini AI client
const genAI = new GoogleGenAI({ apiKey: config.geminiApiKey });

// System instruction for clean code output
const SYSTEM_INSTRUCTION = `You are an expert web developer assistant. Your task is to generate or modify clean, production-ready HTML, CSS, and JavaScript code.

Reply in the same language as the user, and SUPER shortly tell what you did. SUPER short.

CRITICAL OUTPUT RULES - FOLLOW EXACTLY:
1. Return code in the "code" field - absolutely NO markdown code fences, NO explanations
2. Return a SUPER short message in the "message" field in the SAME LANGUAGE as the user
3. Return a TWO-WORD project name in the "projectName" field in the SAME LANGUAGE as the user
4. The code field should contain ONLY the code itself - start directly with <!DOCTYPE html> or the first line of code
5. NO markdown code fences (no \`\`\`html, no \`\`\`, nothing) in the code field
6. The message should be 1-2 sentences maximum
7. The projectName MUST be exactly TWO WORDS that describe the project creatively (e.g., "Solar Dashboard", "Pixel Art", "Magic Quiz")

CODE MODIFICATION RULES:
- If existing code is provided, modify/extend it based on the user's request
- Maintain the existing structure and style unless explicitly asked to change it
- If user says "add", "modify", "change", or "update" - work with the existing code
- If user wants something completely new, you can start fresh
- Preserve working functionality unless asked to remove it

IF YOU NEED IMAGES:
- Use https://static.photos/ for placeholder images, https://static.photos/CATEGORY/RESOLUTION/SEED
- Possible categories: nature, office, people, technology, minimal, abstract, cityscape, workspace, food, travel, finance, medical, wellness, education, industry, gaming, automotive
- Seed can be any integer to get different images
- Example https://static.photos/nature/640x360/1

CODE GENERATION RULES:
1. Generate complete, self-contained HTML files
2. Use inline <style> tags for CSS and inline <script> tags for JavaScript
3. Ensure code is production-ready and runs in any modern browser
4. Use modern, semantic HTML5
5. Create visually appealing designs with good styling
6. Include responsive design principles
7. Make interactive elements functional with proper JavaScript
8. Format code with proper indentation - each tag, style rule, and script line should be on its own line

REMEMBER: Return JSON with "message" (short, in user's language), "projectName" (TWO words only, creative name in user's language), and "code" (clean, properly formatted HTML/CSS/JS, no markdown).`;

// JSON schema for structured output
const CODE_GENERATION_SCHEMA = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "A very short response in the same language as the user describing what was done (1-2 sentences max)",
    },
    projectName: {
      type: "string",
      description: "A creative TWO-WORD name for this project in the same language as the user (e.g., 'Solar Dashboard', 'Pixel Art', 'Magic Quiz')",
    },
    code: {
      type: "string",
      description: "The generated or modified HTML/CSS/JS code without any markdown formatting",
    },
  },
  required: ["message", "projectName", "code"],
};

// System instruction for ASK mode - answering questions without generating code
const ASK_SYSTEM_INSTRUCTION = `You are a helpful web development assistant. Your task is to answer questions about HTML, CSS, JavaScript, and web development in general.

Reply in the same language as the user. Be SHORT, CONCISE, and TO THE POINT. No long explanations.

CRITICAL OUTPUT RULES:
1. Return ONLY a "message" field in JSON format
2. The message should be a short, helpful response (2-4 sentences max)
3. Do NOT generate any code - just explain, suggest, or answer
4. If the user asks how to do something, explain the concept briefly
5. If they ask about the existing code, analyze and give feedback
6. Stay focused on the question - no unnecessary elaboration

REMEMBER: You are in ASK mode - your job is to help and advise, NOT to write or modify code. Keep responses SHORT.`;

// JSON schema for ASK mode structured output
const ASK_SCHEMA = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "A short, helpful response in the same language as the user (2-4 sentences max)",
    },
  },
  required: ["message"],
};

/**
 * Generate code using Gemini API with streaming structured outputs
 */
const generateCode = asyncHandler(async (req, res) => {
  const { prompt, existingCode, messageHistory, mode = "edit", modelPreference = DEFAULT_MODEL_PREFERENCE } = req.body;
  const isAskMode = mode === "ask";
  const selectedModel = getModelPreference(modelPreference);

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

  const sendSse = (data) => {
    if (!res.destroyed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const endSse = () => {
    if (!res.destroyed && !res.writableEnded) {
      res.end();
    }
  };

  let accumulatedText = "";
  let codeStarted = false;
  let codeComplete = false;
  let codeFieldStartPos = -1; // Position after opening quote of code field
  const codeDecoder = createJsonStringDecoder();
  let latestUsageMetadata = null;

  try {
    // Configure generation with system instruction based on mode
    const generationConfig = {
      systemInstruction: isAskMode ? ASK_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: isAskMode ? ASK_SCHEMA : CODE_GENERATION_SCHEMA,
    };

    if (selectedModel.thinkingConfig) {
      generationConfig.thinkingConfig = selectedModel.thinkingConfig;
    } else if (selectedModel.model.startsWith("gemini-3")) {
      generationConfig.thinkingConfig = {
        thinkingLevel: getGeminiThinkingLevel(),
      };
    }

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
    const stream = await genAI.models.generateContentStream({
      model: selectedModel.model,
      contents: userPrompt,
      config: generationConfig,
    });

    // Process the stream
    for await (const chunk of stream) {
      try {
        if (chunk.usageMetadata) {
          latestUsageMetadata = chunk.usageMetadata;
        }

        // Extract text from the chunk
        const chunkText = chunk.text || chunk.candidates?.[0]?.content?.parts?.[0]?.text;

        if (chunkText) {
          // Accumulate the text
          accumulatedText += chunkText;

          // In ASK mode, skip code streaming entirely - we just accumulate the response
          if (isAskMode) {
            // Just continue accumulating, we'll parse and send at the end
            continue;
          }

          // If code field hasn't started yet, look for it
          if (!codeStarted) {
            // Look for "code": pattern
            const codeKeyIndex = accumulatedText.indexOf('"code"');
            if (codeKeyIndex !== -1) {
              // Find the colon after "code"
              const colonPos = accumulatedText.indexOf(":", codeKeyIndex + 6);
              if (colonPos !== -1) {
                // Skip whitespace after colon and find opening quote
                let openQuotePos = colonPos + 1;
                while (openQuotePos < accumulatedText.length && /\s/.test(accumulatedText[openQuotePos])) {
                  openQuotePos++;
                }

                if (accumulatedText[openQuotePos] === '"') {
                  codeStarted = true;
                  codeFieldStartPos = openQuotePos + 1; // Position after opening quote
                  sendSse({ type: "code-start" });

                  // Decode any content we already have after the opening quote
                  const initialContent = accumulatedText.substring(codeFieldStartPos);
                  if (initialContent.length > 0) {
                    const { decoded, done } = codeDecoder.decode(initialContent);
                    if (decoded) {
                      sendSse({ type: "code-chunk", chunk: decoded });
                    }
                    if (done) {
                      codeComplete = true;
                      sendSse({ type: "code-complete" });
                    }
                  }
                }
              }
            }
          } else if (!codeComplete) {
            // Code has started but not complete - decode the new chunk directly
            // We only pass the new chunk text to the decoder (it maintains state)
            const { decoded, done } = codeDecoder.decode(chunkText);

            if (decoded) {
              sendSse({ type: "code-chunk", chunk: decoded });
            }

            if (done) {
              codeComplete = true;
              sendSse({ type: "code-complete" });
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

    // Validate response has required fields based on mode
    if (isAskMode) {
      if (!structuredResponse.message) {
        throw new AppError("Invalid AI response structure", 500, ERROR_CODES.AI_RESPONSE_INVALID);
      }
    } else {
      if (!structuredResponse.code || !structuredResponse.message) {
        throw new AppError("Invalid AI response structure", 500, ERROR_CODES.AI_RESPONSE_INVALID);
      }
    }

    // Ensure code-complete was sent for EDIT mode (handles edge case where stream ends abruptly)
    if (!isAskMode && codeStarted && !codeComplete) {
      sendSse({ type: "code-complete" });
    }

    // Send message-complete event (message field is complete)
    const finalMessage = structuredResponse.message;
    sendSse({ type: "message-complete", message: finalMessage });

    // Get token usage metadata from the stream
    try {
      const usageMetadata = latestUsageMetadata || {};

      // Extract token counts with fallbacks
      const promptTokens = usageMetadata.promptTokenCount || 0;
      const candidatesTokens = usageMetadata.candidatesTokenCount || 0;
      const thoughtsTokens = usageMetadata.thoughtsTokenCount || 0;
      const cachedTokens = usageMetadata.cachedContentTokenCount || 0;
      const totalTokens = usageMetadata.totalTokenCount || promptTokens + candidatesTokens + thoughtsTokens;
      const billableOutputTokens = candidatesTokens + thoughtsTokens;

      // Calculate estimated cost in cents
      const estimatedCost = calculateCostInCents(promptTokens, billableOutputTokens, selectedModel.pricing);

      console.log(
        `[Token Usage] Model: ${selectedModel.model}, Prompt: ${promptTokens}, Candidates: ${candidatesTokens}, Thoughts: ${thoughtsTokens}, Total: ${totalTokens}, Cost: ${estimatedCost.toFixed(6)} cents`,
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
          model: selectedModel.model,
          generationType: isAskMode ? "ask" : "code-generation",
          mode: mode,
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
      code: isAskMode ? "" : structuredResponse.code,
      projectName: isAskMode ? undefined : structuredResponse.projectName,
      remaining: req.workshop?.remaining,
    };

    sendSse(finalData);
    endSse();
  } catch (error) {
    console.error("[AI Generation Error]", error);

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
    } else if (error.message?.includes("Failed to parse stream") || error.message?.includes("parse stream")) {
      errorMessage = "Failed to parse AI response";
      errorCode = ERROR_CODES.AI_RESPONSE_PARSE_FAILED;
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

    sendSse(errorData);
    endSse();
  }
});

module.exports = {
  generateCode,
};
