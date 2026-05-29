import fs from 'fs/promises';
import path from 'path';
import { pipeline, Pipeline } from '@xenova/transformers';

interface TopicVector {
  topic: string;
  vector: number[];
}

export class SemanticSimilarityService {
  private readonly filePath: string;
  private static extractorInstance: Pipeline | null = null;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';

  constructor() {
    this.filePath = path.resolve(process.cwd(), 'src', 'infrastructure', 'data', 'processed_topics_vectors.json');
  }

  private async getExtractor(): Promise<Pipeline> {
    if (!SemanticSimilarityService.extractorInstance) {
      // Load the model as a singleton
      // @ts-ignore - The pipeline type works properly but TS might complain without exact mapping
      SemanticSimilarityService.extractorInstance = await pipeline('feature-extraction', this.modelName);
    }
    return SemanticSimilarityService.extractorInstance!;
  }

  private async getVector(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    // Convert Float32Array to standard number array for JSON storage
    return Array.from(output.data);
  }

  private async readStore(): Promise<TopicVector[]> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data) as TopicVector[];
    } catch (e) {
      return [];
    }
  }

  private async writeStore(store: TopicVector[]): Promise<void> {
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
    await fs.rename(tmpPath, this.filePath);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  public async isSemanticDuplicate(topic: string): Promise<boolean> {
    const store = await this.readStore();
    if (store.length === 0) return false;

    const topicVector = await this.getVector(topic);

    for (const item of store) {
      const sim = this.cosineSimilarity(topicVector, item.vector);
      if (sim > 0.85) {
        return true;
      }
    }
    return false;
  }

  public async registerTopic(topic: string): Promise<void> {
    const topicVector = await this.getVector(topic);
    const store = await this.readStore();
    store.push({ topic, vector: topicVector });
    await this.writeStore(store);
  }
}
