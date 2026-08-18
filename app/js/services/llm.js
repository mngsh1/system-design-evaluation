/**
 * LLMService - Unified client for OpenAI and Google Gemini API
 * Supports multi-turn dialogue, JSON structured output, image vision analysis, and connection tests.
 */

export class LLMService {
  /**
   * Main completion method
   * @param {Object} options
   * @param {string} options.provider - 'gemini' | 'openai'
   * @param {string} options.apiKey - API Key
   * @param {string} options.model - Model name
   * @param {Array} options.messages - [{ role: 'user'|'assistant'|'system', content: string }]
   * @param {string} [options.systemPrompt] - System instruction
   * @param {number} [options.temperature=0.7] - Temperature
   * @param {boolean} [options.jsonMode=false] - Request JSON response
   * @param {string} [options.imageBase64] - Optional base64 encoded PNG for diagram analysis
   */
  static async complete({
    provider,
    apiKey,
    model,
    messages,
    systemPrompt,
    temperature = 0.7,
    jsonMode = false,
    imageBase64 = null
  }) {
    if (!apiKey) {
      throw new Error(`Missing API Key for provider: ${provider.toUpperCase()}. Please configure it in Settings.`);
    }

    if (provider === 'gemini') {
      let activeModel = model || 'gemini-3.1-pro-preview';
      if (activeModel === 'gemini-2.5-pro') {
        activeModel = 'gemini-3.1-pro-preview';
      }
      return await this._completeGemini({
        apiKey,
        model: activeModel,
        messages,
        systemPrompt,
        temperature,
        jsonMode,
        imageBase64
      });
    } else if (provider === 'openai') {
      return await this._completeOpenAI({
        apiKey,
        model: model || 'gpt-5',
        messages,
        systemPrompt,
        temperature,
        jsonMode,
        imageBase64
      });
    } else {
      throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }

  /**
   * Normalize and sanitize Gemini model identifier
   * Converts "Gemini 2.5 Flash Lite" -> "gemini-2.5-flash-lite", strips "models/", etc.
   */
  static _sanitizeGeminiModel(rawModel) {
    if (!rawModel) return 'gemini-3.1-pro-preview';
    let clean = String(rawModel).trim();
    // Strip leading "models/" or "models:"
    clean = clean.replace(/^models[\/:]/i, '');
    // Strip trailing colons or slashes
    clean = clean.replace(/[:\/]+$/, '');
    // Replace whitespace with hyphens and convert to lowercase
    clean = clean.toLowerCase().replace(/\s+/g, '-');
    // Remove redundant multiple hyphens
    clean = clean.replace(/-+/g, '-');
    // Handle deprecated pro model
    if (clean === 'gemini-2.5-pro') {
      clean = 'gemini-3.1-pro-preview';
    }
    return clean || 'gemini-3.1-pro-preview';
  }

  /**
   * Google Gemini API implementation
   */
  static async _completeGemini({
    apiKey,
    model,
    messages,
    systemPrompt,
    temperature,
    jsonMode,
    imageBase64
  }) {
    const cleanModel = this._sanitizeGeminiModel(model);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    // Convert messages to Gemini contents format
    const contents = [];
    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts = [{ text: msg.content }];
      
      // If user message and has image
      if (role === 'user' && imageBase64 && msg === messages[messages.length - 1]) {
        // Strip data:image/png;base64, prefix if present
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: cleanBase64
          }
        });
      }
      contents.push({ role, parts });
    }

    const payload = {
      contents,
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 8192
      }
    };

    if (systemPrompt) {
      payload.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    if (jsonMode) {
      payload.generationConfig.responseMimeType = 'application/json';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errorMsg = errData.error?.message || `Gemini API returned HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Gemini Error: ${errorMsg}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('Gemini returned an empty response. Please try again.');
    }

    const text = candidate.content?.parts?.map(p => p.text).join('') || '';
    
    if (jsonMode) {
      try {
        return JSON.parse(text);
      } catch (e) {
        // Fallback: extract JSON from code fences if needed
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        }
        throw new Error(`Failed to parse structured JSON from Gemini response: ${text.slice(0, 100)}...`);
      }
    }

    return text;
  }

  /**
   * OpenAI API implementation
   */
  static async _completeOpenAI({
    apiKey,
    model,
    messages,
    systemPrompt,
    temperature,
    jsonMode,
    imageBase64
  }) {
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const formattedMessages = [];
    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isLast = i === messages.length - 1;

      if (isLast && msg.role === 'user' && imageBase64) {
        const imageUrl = imageBase64.startsWith('data:') 
          ? imageBase64 
          : `data:image/png;base64,${imageBase64}`;

        formattedMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: msg.content },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
          ]
        });
      } else {
        formattedMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    const payload = {
      model: (model || 'gpt-5').trim(),
      messages: formattedMessages,
      temperature
    };

    if (jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errorMsg = errData.error?.message || `OpenAI API returned HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`OpenAI Error: ${errorMsg}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    if (jsonMode) {
      try {
        return JSON.parse(content);
      } catch (e) {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        }
        throw new Error(`Failed to parse structured JSON from OpenAI response: ${content.slice(0, 100)}...`);
      }
    }

    return content;
  }

  /**
   * Diagnostic test connection helper
   */
  static async testConnection(provider, apiKey, model) {
    const startTime = performance.now();
    try {
      const testPrompt = [{ role: 'user', content: 'Reply with the single word "CONNECTED".' }];
      const result = await this.complete({
        provider,
        apiKey,
        model,
        messages: testPrompt,
        temperature: 0.1,
        jsonMode: false
      });
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        success: true,
        provider,
        model,
        latencyMs,
        response: (typeof result === 'string' ? result : JSON.stringify(result)).trim()
      };
    } catch (err) {
      return {
        success: false,
        provider,
        model,
        error: err.message
      };
    }
  }
}
