# Privacy Policy for System Design Interview Copilot

**Last updated:** August 18, 2026  
**Developer:** Mangesh Chimankar  
**Extension:** System Design Interview Copilot  

---

## 1. Overview
System Design Interview Copilot is committed to user privacy and data security. This extension operates entirely client-side on your device using a **Bring-Your-Own-Key (BYOK)** model.

---

## 2. Information We Collect and Store
- **API Keys**: When you provide an API key (Google Gemini or OpenAI), it is stored locally in your browser's private `chrome.storage.local`. Your API keys are **never transmitted to any third-party server, developer server, or analytics platform**.
- **Interview History & Notes**: Your practice diagrams, functional/non-functional requirements, calculations, and evaluation scorecards are stored strictly in your browser's local storage (`chrome.storage.local`).
- **Personal Information**: We do **not** collect your name, email address, IP address, browsing history, or personal identifiers.

---

## 3. Data Transmission & Third-Party Services
- **Direct API Calls**: When you trigger an AI action (evaluating requirements, analyzing architecture diagrams, generating deep-dive challenges, or generating gold-standard solutions), the extension connects **directly from your browser** to the chosen provider's official API endpoint:
  - Google Gemini API (`https://generativelanguage.googleapis.com`)
  - OpenAI API (`https://api.openai.com`)
- No intermediate servers or proxy relays are used. All data transmission occurs over secure encrypted HTTPS connections directly between your browser and the respective API provider.

---

## 4. Single-Purpose Use
This extension has a single purpose: to assist software engineers in practicing, simulating, and evaluating real-world system design technical interviews.

---

## 5. Contact
If you have any questions or feedback regarding this privacy policy, please contact:
- **Developer**: Mangesh Chimankar
- **Project Repository**: [GitHub Repository / SystemDesignEvaluation]
