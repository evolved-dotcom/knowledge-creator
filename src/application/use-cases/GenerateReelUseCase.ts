import { ILLMService } from '../../domain/ports/ILLMService.js';
import { IRenderService } from '../../domain/ports/IRenderService.js';
import { ReelConcept } from '../../domain/models/ReelConcept.js';

export interface GenerateReelUseCaseResponse {
  concept: ReelConcept;
  localImagePath: string;
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
    console.log(`   🔸 Title: ${concept.topic}`);
    console.log(`   🔸 Image Prompt to be sent: "${concept.imagePrompt}"`);
    console.log(`   🔸 Content: ${concept.contentText}`);

    console.log(`\n[GenerateReelUseCase] 2️⃣ Sending image prompt to ComfyUI Render Service...`);
    const localImagePath = await this.renderService.renderImage(concept.imagePrompt);
    
    console.log(`[GenerateReelUseCase] ✅ Render completed successfully!`);
    console.log(`   🔸 Image saved locally at: ${localImagePath}`);

    return {
      concept,
      localImagePath
    };
  }
}
