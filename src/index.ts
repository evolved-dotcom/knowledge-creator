import * as dotenv from 'dotenv';
dotenv.config();

import { GeminiLLMAdapter } from './infrastructure/adapters/GeminiLLMAdapter.js';
import { ComfyUIRenderAdapter } from './infrastructure/adapters/ComfyUIRenderAdapter.js';
import { GenerateReelUseCase } from './application/use-cases/GenerateReelUseCase.js';
import { LocalQueueRepository } from './infrastructure/repositories/LocalQueueRepository.js';
import { SemanticSimilarityService } from './infrastructure/services/SemanticSimilarityService.js';

(async () => {
  try {
    console.log("Starting Knowledge Creator Engine...");

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error("Missing GEMINI_API_KEY in environment variables");
    }

    const comfyUiUrl = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';

    // 1. Instantiate Adapters and Repositories
    const llmAdapter = new GeminiLLMAdapter(geminiApiKey);
    const renderAdapter = new ComfyUIRenderAdapter(comfyUiUrl);
    const queueRepository = new LocalQueueRepository();
    const semanticSimilarityService = new SemanticSimilarityService();

    // 2. Instantiate Use Case
    const generateReelUseCase = new GenerateReelUseCase(llmAdapter, renderAdapter);

    // 3. Evaluate CLI mode
    const args = process.argv.slice(2);
    const isQueueMode = args.includes('--process-queue');

    if (isQueueMode) {
      console.log("\n[QUEUE] Starting Queue-Driven Processing Mode...");

      while (true) {
        const nextTopic = await queueRepository.getNextTopic();
        
        if (!nextTopic) {
          console.log("\n[QUEUE] No topics left in queue. Exiting.");
          break;
        }

        const remaining = await queueRepository.getQueueLength();
        console.log(`\n[QUEUE] Processing topic: "${nextTopic}" (${remaining} item(s) in queue)`);

        try {
          const isDuplicate = await semanticSimilarityService.isSemanticDuplicate(nextTopic);
          if (isDuplicate) {
            console.log(`[QUEUE] 🛑 Semantic duplicate detected for: "${nextTopic}". Aborting generation.`);
            continue;
          }

          const result = await generateReelUseCase.execute(nextTopic);
          
          console.log(`[QUEUE] ✅ Generation Complete for: "${nextTopic}"`);
          console.log(`[QUEUE] Local Image Paths: ${result.localImagePaths.join(', ')}`);
          
          await semanticSimilarityService.registerTopic(nextTopic);
        } catch (taskError) {
          console.error(`\n[QUEUE] ❌ Error processing topic: "${nextTopic}"`);
          console.error(taskError);
          console.log("[QUEUE] Skipping topic and allowing the next topic to be evaluated.");
        } finally {
          // Remove the processed or failed topic to prevent an infinite loop
          await queueRepository.removeFirstTopic();
          
          // Mandatory 10-second cooldown for RTX 4060 Ti VRAM garbage collection
          console.log("[QUEUE] ⏳ Cooling down for 10 seconds to free up VRAM...");
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
    } else {
      // Standard single execution
      const testTopic = "The concept of impermanence in philosophy";
      console.log(`\nExecuting single use case for topic: "${testTopic}"...`);

      const result = await generateReelUseCase.execute(testTopic);

      console.log("\n✅ Generation Complete!");
      console.log("=== Reel Concept ===");
      console.log(JSON.stringify(result.concept, null, 2));
      console.log("====================");
      console.log(`Local Image Paths: ${result.localImagePaths.join(', ')}`);
    }

  } catch (error) {
    console.error("\n❌ Top-level execution error:");
    console.error(error);
    process.exit(1);
  }
})();
