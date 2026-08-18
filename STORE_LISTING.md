# Chrome Web Store Listing & Submission Guide

Use these exact copy-paste values when filling out the form on the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devcenter).

---

## 1. Store Metadata

- **Item Title**: `System Design Interview Copilot`
- **Short Description** *(Max 132 chars)*:  
  `AI-powered System Design Interview Copilot with interactive architecture canvas, deep dives, and stage-by-stage FAANG evaluation.`
- **Category**: `Developer Tools` (or `Productivity`)
- **Language**: `English`

---

## 2. Detailed Description *(Markdown / Formatted Text)*

```
🚀 Master Senior, Staff, and Principal System Design Interviews with AI-Powered Real-Time Feedback and Evaluation!

System Design Interview Copilot is an interactive simulation and assessment studio built directly into your browser. Practice FAANG-style system design questions with step-by-step guidance, real-time architecture diagramming, and strict calibration against industry rubrics.

🌟 KEY FEATURES:

🎯 1. Curated & Custom Problem Catalog
• 10+ Tier-1 production design problems across Distributed Caching, Ride-Hailing Match, Financial Ledgers, Video Transcoding & Event Streams.
• Create custom problems with custom traffic scale, QPS metrics, and interviewer personas.
• Filter by Mid-Level, Senior, Staff, and Principal difficulty.

💬 2. Phase 1: Problem Scope & Clarification
• Engage in multi-turn interactive dialogue with an AI interviewer.
• Clarify functional boundaries, throughput SLAs, latency targets, and multi-region availability.

📐 3. Phase 2: Requirements & Calculations
• Structure functional and non-functional requirements.
• Built-in back-of-the-envelope estimation workspace with automated math and SLA evaluation.

🏗️ 4. Phase 3: Interactive Architecture Canvas & Live Vision AI Evaluation
• Draw distributed architecture diagrams directly on an interactive canvas with microservices, databases, load balancers, and caches.
• AI evaluates your diagram topology, single points of failure (SPOFs), and data flow.

🛡️ 5. Phase 4: Architectural Deep Dives
• Face tough follow-up technical questions on cache stampedes, distributed consensus, partition rebalancing, and disaster recovery.

📊 6. Phase 5: Final Review Scorecard & Gold-Standard FAANG Blueprints
• Receive a comprehensive FAANG-calibrated scorecard with weighted competency ratings.
• Timed breakdown across all interview phases.
• Compare against production-grade Gold-Standard reference architectures with on-demand AI regeneration.
• Export your full interview summary to PDF.

⚙️ Bring Your Own Key (BYOK) & Multi-Model Support:
• Powered by Google Gemini (Gemini 3.1 Pro, 2.5 Flash) and OpenAI (GPT-5, GPT-4o, o3-mini).
• 100% Client-Side Privacy: Your keys and practice history remain on your local machine.

Crafted by Mangesh Chimankar.
```

---

## 3. Privacy Tab & Justifications *(Required by Chrome Web Store)*

### Single Purpose Description:
> "To provide software engineers with an interactive system design mock interview practice tool featuring stage-by-stage architecture evaluation, diagramming canvas, and FAANG rubric scoring."

### Permission Justifications:
- **`storage` / `unlimitedStorage`**:  
  > "Used to store user interview problem states, diagram canvas data, user notes, and past practice scorecard history locally on the user's browser."
- **`tabs`**:  
  > "Used to open and focus the full-screen interactive interview studio tab when clicked from the extension popup launcher."
- **Host Permissions (`https://generativelanguage.googleapis.com/*`, `https://api.openai.com/*`)**:  
  > "Used solely to send candidate design prompts and diagrams directly to the user-selected AI API (Google Gemini or OpenAI) using their own API key."

### Data Usage Declarations:
- **Account Information**: Not collected
- **Financial & Payment Data**: Not collected
- **Web History**: Not collected
- **User Activity**: Not collected
- **Certifications**: Check *"I certify that this extension complies with the Developer Program Policies and do not sell user data."*
