import { ReelConcept } from '../models/ReelConcept.js';

export interface ILLMService {
  generateReelConcept(topic: string): Promise<ReelConcept>;
}
