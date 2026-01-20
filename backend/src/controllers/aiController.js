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

CRITICAL OUTPUT RULES - FOLLOW EXACTLY:
1. Return ONLY code - absolutely NO explanations, NO commentary, NO markdown
2. NO markdown code fences (no \`\`\`html, no \`\`\`, nothing)
3. NO phrases like "Here's the code", "I've created", "This will", etc.
4. NO comments explaining what you did or why
5. Start directly with <!DOCTYPE html> or the first line of code
6. End with the closing tag - nothing after

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

REMEMBER: Your response should be ONLY the code itself. No wrapping, no explanation, no markdown.`;

/**
 * Extract code from potential markdown blocks
 * Handles cases where AI returns code wrapped in markdown
 */
const extractCode = (text) => {
  if (!text) return "";

  // Remove markdown code fences if present
  let cleaned = text.trim();

  // Match ```html, ```css, ```javascript, ```js, or just ```
  const codeBlockRegex = /^```(?:html|css|javascript|js)?\n?([\s\S]*?)```$/;
  const match = cleaned.match(codeBlockRegex);

  if (match) {
    cleaned = match[1].trim();
  }

  // Also handle multiple code blocks by extracting content
  const multiBlockRegex = /```(?:html|css|javascript|js)?\n?([\s\S]*?)```/g;
  let multiMatch;
  const blocks = [];

  while ((multiMatch = multiBlockRegex.exec(text)) !== null) {
    blocks.push(multiMatch[1].trim());
  }

  // If we found multiple blocks, join them
  if (blocks.length > 1) {
    cleaned = blocks.join("\n\n");
  } else if (blocks.length === 1) {
    cleaned = blocks[0];
  }

  return cleaned;
};

/**
 * Generate code using Gemini API
 */
const generateCode = asyncHandler(async (req, res) => {
  const { prompt, existingCode } = req.body;

  if (!prompt) {
    throw new AppError("Prompt is required", 400);
  }

  if (!config.geminiApiKey) {
    throw new AppError("Gemini API key not configured", 500);
  }

  try {
    // Initialize the model with system instruction
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    // Build the user prompt with context
    let userPrompt = prompt;
    if (existingCode && existingCode.trim()) {
      userPrompt = `EXISTING CODE:
\`\`\`html
${existingCode}
\`\`\`

USER REQUEST: ${prompt}

Modify or extend the existing code based on the user's request. Return ONLY the complete updated code with no explanations.`;
    }

    // Generate content
    const result = await model.generateContent(userPrompt);
    const response = await result.response;
    const text = response.text();

    // Extract clean code from response
    const code = extractCode(text);

    res.json({
      code,
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
