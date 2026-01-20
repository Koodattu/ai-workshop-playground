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
const SYSTEM_INSTRUCTION = `You are an expert web developer assistant. Your task is to generate clean, production-ready HTML, CSS, and JavaScript code.

IMPORTANT RULES:
1. Return ONLY code - no explanations, no markdown formatting, no comments about what the code does
2. If generating a complete webpage, include all HTML, CSS, and JavaScript in a single HTML file
3. Use inline <style> tags for CSS and inline <script> tags for JavaScript
4. Ensure the code is complete and ready to run in a browser
5. Use modern, semantic HTML5
6. Make the design visually appealing with good default styling
7. Include responsive design principles
8. Do not include any markdown code fences or language identifiers`;

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
  const { prompt } = req.body;

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

    // Generate content
    const result = await model.generateContent(prompt);
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
