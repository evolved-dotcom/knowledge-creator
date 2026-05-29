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

const categorySchema = z.enum(["History", "Science", "Technology", "Psychology", "Culture", "Philosophy", "Art", "Economics", "Geography", "Mythology", "Biographies"]);

const reelConceptSchema = z.discriminatedUnion('format', [
  z.object({
    format: z.literal('deep_dive'),
    topic: z.string(),
    category: categorySchema,
    tags: z.array(z.string()).max(3),
    deepExplanation: z.string(),
    mainImagePrompt: z.string(),
  }),
  z.object({
    format: z.literal('trinity'),
    topic: z.string(),
    category: categorySchema,
    tags: z.array(z.string()).max(3),
    slides: z.tuple([
      z.object({ text: z.string(), imagePrompt: z.string() }),
      z.object({ text: z.string(), imagePrompt: z.string() }),
      z.object({ text: z.string(), imagePrompt: z.string() })
    ])
  })
]);

export class GeminiLLMAdapter implements ILLMService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Gemini API key is missing");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
  }

  public async generateReelConcept(topic: string): Promise<ReelConcept> {
    const prompt = `
  Eres un erudito experto en divulgación cultural, historia, filosofía, ciencia y folklore, con una habilidad magistral para retener la atención del usuario (estilo TikTok/Reels).
  Tu objetivo es generar contenido fascinante y de alto valor educativo basado en el tema proporcionado: "${topic}".
  
  FORMATOS PERMITIDOS (Elige uno dinámicamente según el tema):
  1) "deep_dive": Para conceptos singulares que requieren una explicación profunda y detallada.
  2) "trinity": Para procesos narrativos que se benefician de una estructura de 3 actos (Inicio, Nudo, Desenlace).
  
  TAXONOMÍA ESTRICTA (OBLIGATORIO):
  Debes clasificar el tema obligatoriamente en UNA de estas categorías exactas: "History", "Science", "Technology", "Psychology", "Culture", "Philosophy", "Art", "Economics", "Geography", "Mythology", "Biographies".
  Debes generar exactamente entre 1 y 3 etiquetas (tags) SEO-friendly relacionadas con el tema.

  REGLAS DE INGENIERÍA VISUAL (imagePrompt):
  - El prompt visual DEBE ESTAR ESTRICTAMENTE EN INGLÉS (optimizado para el modelo FLUX).
  - OBLIGATORIO EN TODOS LOS PROMPTS: Añade al final de la descripción "Deep, pure black shadows at the extreme top and extreme bottom of the composition to allow white text overlay, no text in the image".
  
  Si eliges "deep_dive", devuelve ÚNICAMENTE este JSON:
  {
    "format": "deep_dive",
    "topic": "${topic}",
    "category": "Categoría Exacta",
    "tags": ["tag1", "tag2", "tag3"],
    "deepExplanation": "Explicación magistral y extensa en español",
    "mainImagePrompt": "Prompt visual en inglés"
  }
  
  Si eliges "trinity", devuelve ÚNICAMENTE este JSON con EXACTAMENTE 3 slides:
  {
    "format": "trinity",
    "topic": "${topic}",
    "category": "Categoría Exacta",
    "tags": ["tag1", "tag2", "tag3"],
    "slides": [
      { "text": "Texto del Acto 1", "imagePrompt": "Prompt 1 en inglés" },
      { "text": "Texto del Acto 2", "imagePrompt": "Prompt 2 en inglés" },
      { "text": "Texto del Acto 3", "imagePrompt": "Prompt 3 en inglés" }
    ]
  }
`;

    try {
      const maxRetries = 3;
      let attempt = 0;
      let delayMs = 4000;
      let result;

      while (attempt <= maxRetries) {
        try {
          result = await this.model.generateContent(prompt);
          break; // Success, exit retry loop
        } catch (error: any) {
          if (error.status === 429 || (error.message && error.message.includes('429'))) {
            if (attempt >= maxRetries) {
              throw new Error(`Failed to generate content after ${maxRetries} retries due to 429 Too Many Requests: ${error.message}`);
            }
            console.warn(`[GeminiLLMAdapter] ⚠️ Rate limit hit (429). Retrying in ${delayMs / 1000}s... (Attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs *= 2; // Exponential backoff: 4s, 8s, 16s...
            attempt++;
          } else {
            throw error;
          }
        }
      }

      if (!result) {
        throw new Error("Failed to generate content: result is undefined");
      }

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

      let concept: ReelConcept;
      if (validData.format === 'deep_dive') {
        concept = {
          id: randomUUID(),
          format: 'deep_dive',
          topic: validData.topic,
          category: validData.category,
          tags: validData.tags,
          syncStatus: 'generated',
          deepExplanation: validData.deepExplanation,
          mainImagePrompt: validData.mainImagePrompt,
          createdAt: new Date(),
        };
      } else {
        concept = {
          id: randomUUID(),
          format: 'trinity',
          topic: validData.topic,
          category: validData.category,
          tags: validData.tags,
          syncStatus: 'generated',
          slides: validData.slides,
          createdAt: new Date(),
        };
      }

      return concept;

    } catch (error: unknown) {
      if (error instanceof LLMValidationError) {
        throw error;
      }
      throw new Error(`Failed to generate content from Gemini: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
