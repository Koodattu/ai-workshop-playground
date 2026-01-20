### 1. The Architecture

To keep it simple for a workshop, you can use a **React** or **Vue** frontend and a simple **Node.js/Express** or **Python/Flask** backend.

- **Frontend:** Handles the UI layout, the code state, and the "execution" environment.
- **Backend:** Acts as a secure proxy to call the Gemini API (to keep your API keys hidden from the client).
- **LLM (Gemini):** Receives the user prompt and returns the code string.

---

### 2. How to "Run" the Code (The Easy Way)

The most common and "easy" way to run HTML/JS/CSS dynamically in a browser is using an **`<iframe>`**.

1. **The Concept:** You take the code string from your editor and "inject" it into an empty iframe.
2. **The Method:** You can use the `srcdoc` attribute of the iframe. When the user clicks "Run," you update the state of the `srcdoc`.

**Example Logic:**

```javascript
// Combine the code into a single HTML blob
const fullCode = `
  <html>
    <style>${cssCode}</style>
    <body>
      ${htmlCode}
      <script>${jsCode}<\/script>
    </body>
  </html>
`;

// In your JSX/HTML:
<iframe srcDoc={fullCode} title="output" sandbox="allow-scripts" />;
```

> **Security Note:** Always use the `sandbox="allow-scripts"` attribute on your iframe. This prevents the generated code from accessing the parent page's cookies or redirecting the main window.

---

### 3. Suggested Tech Stack

If you want to get this running quickly for a workshop, I recommend:

| Component              | Recommendation                                         | Why?                                                     |
| ---------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| **Frontend Framework** | **React** or **Next.js**                               | Great for managing the state of the code and chat.       |
| **Code Editor**        | **Monaco Editor** (VS Code's engine) or **CodeMirror** | These have React wrappers that are very easy to drop in. |
| **Styling**            | **Tailwind CSS**                                       | Perfect for building a 3-column layout in minutes.       |
| **Backend**            | **Node.js (Express)**                                  | You can use the `@google/generative-ai` SDK easily.      |

---

### 4. Handling the AI Prompting

To make this work well, you need to use **System Instructions** when calling Gemini. You want to tell the AI:

- "You are a web development assistant."
- "Always return your code inside a single block."
- "Do not provide long explanations, just the code."

You will then need a simple "parser" on your frontend to extract the code from the Markdown response (e.g., stripping away the ```html tags).

---

### 5. Potential Challenges to Watch For

- **Prompt Injection:** Users might try to make the AI do things other than code. System instructions help mitigate this.
- **State Management:** If the AI generates _new_ code, do you overwrite the user's current work or append to it? (Overwriting is easier for a V1).
- **Rate Limits:** Since it's for a workshop, ensure your API billing/tier can handle multiple users hitting the "Generate" button at once.
