import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { ILLMService } from '../../domain/ports/ILLMService.js';
import { ReelConcept } from '../../domain/models/ReelConcept.js';

export class LLMValidationError extends Error {
  constructor(message: string, public readonly errors?: unknown) {
    super(message);
    this.name = 'LLMValidationError';
  }
}

const reelConceptSchema = z.object({
  topic: z.string(),
  contentText: z.string(),
  explanation: z.string(),
  imagePrompt: z.string(),
});

export class GeminiLLMAdapter implements ILLMService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Gemini API key is missing");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
  }

  public async generateReelConcept(topic: string): Promise<ReelConcept> {
    const prompt = `
  Eres un erudito experto en divulgación cultural, historia, filosofía, ciencia y folklore, con una habilidad magistral para retener la atención del usuario (estilo TikTok/Reels).
  Tu objetivo es generar contenido fascinante y de alto valor educativo basado en el tema proporcionado: "${topic}".
  
  REGLAS DE ESCRITURA (El Efecto "Wow"):
  - "contentText": Debe ser un gancho narrativo brutal. Una verdad impactante, un refrán, o un dato histórico que rompa esquemas. Redacción impecable, directa al cerebro del lector. (Aprox. 2-4 frases).
  - "explanation": La disección profunda. Si es un refrán, explica su origen histórico real. Si es ciencia, explica el mecanismo oculto. Si es historia, el contexto olvidado. El usuario debe sentir que acaba de aprender algo invaluable que necesita compartir.

  REGLAS DE INGENIERÍA VISUAL (imagePrompt):
  - El prompt visual DEBE ESTAR ESTRICTAMENTE EN INGLÉS (optimizado para el modelo FLUX).
  - DEBES adaptar dinámicamente el estilo artístico a la categoría del tema:
    * Si es nihilismo/filosofía oscura: Inicia con "Zdzisław Beksiński style, dark surrealism, macabre, highly textured".
    * Si es historia (ej. Imperio Romano, Catalina la Grande): Inicia con "Cinematic historical photography, highly detailed, dramatic lighting, period-accurate attire, epic composition".
    * Si es ciencia/anatomía: Inicia con "Hyper-realistic macro photography, 3d render, Unreal Engine 5, scientific visualization, intricate details".
    * Si es un refrán/folklore: Inicia con "Classic masterpiece oil painting, atmospheric, expressive, folkloric aesthetic".
  - OBLIGATORIO EN TODOS LOS PROMPTS (Para la UI de la app): Debes incluir siempre al final de la descripción esta directiva: "Deep, pure black shadows at the extreme top and extreme bottom of the composition to allow white text overlay, no text in the image".
  
  Devuelve ÚNICAMENTE un objeto JSON estricto con esta estructura exacta, sin bloques markdown (\`\`\`json) ni texto adicional:
  {
    "topic": "El tema solicitado",
    "contentText": "El gancho narrativo impactante en español",
    "explanation": "La explicación profunda y educativa en español",
    "imagePrompt": "El prompt visual dinámico en inglés aplicando el estilo correcto"
  }
`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(responseText);
      } catch (parseError) {
        throw new LLMValidationError("Failed to parse LLM response as JSON", parseError);
      }

      const validationResult = reelConceptSchema.safeParse(parsedJson);

      if (!validationResult.success) {
        throw new LLMValidationError("Invalid schema returned by LLM", validationResult.error.format());
      }

      const validData = validationResult.data;

      const concept: ReelConcept = {
        id: randomUUID(),
        topic: validData.topic,
        contentText: validData.contentText,
        explanation: validData.explanation,
        imagePrompt: validData.imagePrompt,
        createdAt: new Date(),
      };

      return concept;

    } catch (error: unknown) {
      if (error instanceof LLMValidationError) {
        throw error;
      }
      throw new Error(`Failed to generate content from Gemini: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
