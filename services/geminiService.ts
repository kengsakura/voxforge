import { AppSettings, VoiceName, SpeedSetting } from "../types";
import { base64ToFloat32Array } from "../utils/audioUtils";

export class GeminiService {
  private apiKey: string | undefined = undefined;
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

  constructor(apiKey?: string) {
    // Priority: User Setting -> Env Var
    this.apiKey = apiKey || import.meta.env.VITE_API_KEY;
  }

  updateApiKey(key: string) {
    this.apiKey = key;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async generateSpeech(
    text: string,
    model: string,
    voice: VoiceName,
    systemPrompt: string,
    speed: SpeedSetting,
    temperature: number
  ): Promise<Float32Array> {
    if (!this.apiKey) throw new Error("API Key not configured");

    // Combine system prompt with text as the content
    // TTS models don't support systemInstruction, so we prepend style instructions to the text
    let finalText = text;
    if (systemPrompt && systemPrompt.trim()) {
      finalText = `${systemPrompt}\n\n${text}`;
    }
    if (speed !== SpeedSetting.Normal) {
      finalText = `Speaking Rate: ${speed.toLowerCase()} pace.\n\n${finalText}`;
    }

    const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;

    const payload = {
      contents: [{
        parts: [{ text: finalText }],
      }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Gemini API Error Details:", errorData);
        throw new Error(`Gemini API Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];

      if (!candidate) throw new Error("No candidates returned");

      const audioPart = candidate.content?.parts?.find((p: any) => p.inlineData);

      if (audioPart && audioPart.inlineData && audioPart.inlineData.data) {
        return base64ToFloat32Array(audioPart.inlineData.data);
      } else {
        throw new Error("No audio data found in response");
      }
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }
}
