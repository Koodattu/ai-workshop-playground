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
 * Generate code using Gemini API with structured outputs
 */
const generateCode = asyncHandler(async (req, res) => {
  const { prompt, existingCode, messageHistory } = req.body;

  if (!prompt) {
    throw new AppError("Prompt is required", 400);
  }

  if (!config.geminiApiKey) {
    throw new AppError("Gemini API key not configured", 500);
  }

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

    // Generate content with structured output
    const result = await model.generateContent(userPrompt);
    const response = await result.response;
    const text = response.text();

    // Parse the structured JSON response
    let structuredResponse;
    try {
      structuredResponse = JSON.parse(text);
    } catch (parseError) {
      throw new AppError("Failed to parse AI response", 500);
    }

    // Validate response has required fields
    if (!structuredResponse.code || !structuredResponse.message) {
      throw new AppError("Invalid AI response structure", 500);
    }

    res.json({
      message: structuredResponse.message,
      code: structuredResponse.code,
      remaining: req.workshop?.remaining,
    });
  } catch (error) {
    // Handle specific Gemini API errors
    if (error.message?.includes("API key")) {
      throw new AppError("Invalid API configuration", 500);
    }

    if (error.message?.includes("quota")) {
      throw new AppError("API quota exceeded. Please try again later.", 503);
    }

    if (error.message?.includes("safety")) {
      throw new AppError("Request blocked due to safety filters", 400);
    }

    throw new AppError(`AI generation failed: ${error.message}`, 500);
  }
});

module.exports = {
  generateCode,
};
