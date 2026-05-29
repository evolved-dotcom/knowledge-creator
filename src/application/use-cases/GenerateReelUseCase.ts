import { ILLMService } from '../../domain/ports/ILLMService.js';
import { IRenderService } from '../../domain/ports/IRenderService.js';
import { ReelConcept } from '../../domain/models/ReelConcept.js';

export interface GenerateReelUseCaseResponse {
  concept: ReelConcept;
  localImagePaths: string[];
}

export class GenerateReelUseCase {
  constructor(
    private readonly llmService: ILLMService,
    private readonly renderService: IRenderService
  ) {}

  public async execute(topic: string): Promise<GenerateReelUseCaseResponse> {
    console.log(`\n[GenerateReelUseCase] 1️⃣ Contacting LLM to generate concept for topic: "${topic}"...`);
    const concept = await this.llmService.generateReelConcept(topic);
    
    console.log(`[GenerateReelUseCase] ✅ Concept successfully generated!`);
    console.log(`   🔸 Format: ${concept.format}`);
    console.log(`   🔸 Category: ${concept.category}`);
    console.log(`   🔸 Tags: [${concept.tags.join(', ')}]`);
    console.log(`   🔸 Sync Status: ${concept.syncStatus}`);
    const localImagePaths: string[] = [];
    console.log(`\n[GenerateReelUseCase] 2️⃣ Sending image prompt(s) to ComfyUI Render Service...`);

    if (concept.format === 'deep_dive') {
      console.log(`   🔸 Deep Dive Explanation: ${concept.deepExplanation}`);
      console.log(`   🔸 Image Prompt to be sent: "${concept.mainImagePrompt}"`);
      const path = await this.renderService.renderImage(concept.mainImagePrompt);
      localImagePaths.push(path);
      console.log(`   🔸 Image saved locally at: ${path}`);
    } else if (concept.format === 'trinity') {
      console.log(`   🔸 Trinity Slides generation started`);
      for (let i = 0; i < concept.slides.length; i++) {
        const slide = concept.slides[i];
        console.log(`   🔸 Slide ${i + 1} Text: ${slide.text}`);
        console.log(`   🔸 Slide ${i + 1} Image Prompt: "${slide.imagePrompt}"`);
        const path = await this.renderService.renderImage(slide.imagePrompt);
        localImagePaths.push(path);
        console.log(`   🔸 Slide ${i + 1} Image saved locally at: ${path}`);
        
        // Mandatory 10s cooldown between GPU renders
        if (i < concept.slides.length - 1) {
          console.log(`[GenerateReelUseCase] ⏳ Mandatory 10-second GPU cooldown between slides...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
    }

    console.log(`[GenerateReelUseCase] ✅ Render process completed successfully!`);

    return {
      concept,
      localImagePaths
    };
  }
}
