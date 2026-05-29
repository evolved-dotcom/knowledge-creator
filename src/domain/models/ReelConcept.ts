export type ConceptCategory = "History" | "Science" | "Technology" | "Psychology" | "Culture" | "Philosophy" | "Art" | "Economics" | "Geography" | "Mythology" | "Biographies";
export type SyncStatus = 'generated' | 'synced' | 'failed';

export interface BaseReelConcept {
  id: string;
  topic: string;
  category: ConceptCategory;
  tags: string[];
  syncStatus: SyncStatus;
  createdAt: Date;
}

export interface DeepDiveReelConcept extends BaseReelConcept {
  format: 'deep_dive';
  deepExplanation: string;
  mainImagePrompt: string;
}

export interface TrinitySlide {
  text: string;
  imagePrompt: string;
}

export interface TrinityReelConcept extends BaseReelConcept {
  format: 'trinity';
  slides: [TrinitySlide, TrinitySlide, TrinitySlide];
}

export type ReelConcept = DeepDiveReelConcept | TrinityReelConcept;
