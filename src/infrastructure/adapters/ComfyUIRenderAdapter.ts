import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { IRenderService } from '../../domain/ports/IRenderService.js';

export class RenderAdapterError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'RenderAdapterError';
  }
}

export class ComfyUIRenderAdapter implements IRenderService {
  private readonly baseUrl: string;
  private readonly outputDir: string;
  private readonly pollingIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(
    baseUrl: string = 'http://127.0.0.1:8188', 
    outputDir: string = './output',
    pollingIntervalMs: number = 2000,
    timeoutMs: number = 120000 // 2 minutes timeout
  ) {
    this.baseUrl = baseUrl;
    this.outputDir = outputDir;
    this.pollingIntervalMs = pollingIntervalMs;
    this.timeoutMs = timeoutMs;
  }

  public async renderImage(imagePrompt: string): Promise<string> {
    try {
      await this.ensureOutputDir();

      const promptId = await this.queuePrompt(imagePrompt);
      const outputImageData = await this.pollHistory(promptId);
      
      const localFilePath = await this.downloadAndSaveImage(outputImageData);
      return localFilePath;

    } catch (error: unknown) {
      if (error instanceof RenderAdapterError) {
        throw error;
      }
      throw new RenderAdapterError(`Failed to render image via ComfyUI: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      throw new RenderAdapterError('Could not create output directory', error);
    }
  }

  private async queuePrompt(imagePrompt: string): Promise<string> {
    const configPath = path.resolve(process.cwd(), 'config.json');
    let workflowRaw: string;
    try {
      workflowRaw = await fs.readFile(configPath, 'utf-8');
    } catch (error) {
      throw new RenderAdapterError('Could not read config.json workflow file', error);
    }

    const workflowNodes = JSON.parse(workflowRaw);

    // Inject the generated prompt into node 6
    if (workflowNodes["6"] && workflowNodes["6"].inputs) {
      workflowNodes["6"].inputs.text = imagePrompt;
    }

    // Randomize the seed in node 9 to get unique generations
    if (workflowNodes["9"] && workflowNodes["9"].inputs) {
      workflowNodes["9"].inputs.seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    }

    const workflow = {
      prompt: workflowNodes
    };

    const response = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new RenderAdapterError(`ComfyUI /prompt returned ${response.status}`, text);
    }

    const data = await response.json();
    if (!data.prompt_id) {
      throw new RenderAdapterError('ComfyUI response missing prompt_id', data);
    }

    return data.prompt_id;
  }

  private async pollHistory(promptId: string): Promise<{ filename: string; subfolder: string; type: string }> {
    const startTime = Date.now();

    while (Date.now() - startTime < this.timeoutMs) {
      const response = await fetch(`${this.baseUrl}/history/${promptId}`);
      if (!response.ok) {
        throw new RenderAdapterError(`ComfyUI /history returned ${response.status}`);
      }

      const data = await response.json();
      
      // If the prompt is finished, it appears in the history object
      if (data[promptId]) {
        const historyObj = data[promptId];
        // ComfyUI history format typically has 'outputs' -> nodeId -> 'images' array
        const outputs = historyObj.outputs || {};
        
        // Find the first node that produced an image
        for (const nodeId in outputs) {
          if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
            return outputs[nodeId].images[0]; // { filename, subfolder, type }
          }
        }
        
        throw new RenderAdapterError('Job completed but no images found in history output', historyObj);
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, this.pollingIntervalMs));
    }

    throw new RenderAdapterError(`ComfyUI polling timed out after ${this.timeoutMs}ms`);
  }

  private async downloadAndSaveImage(imageData: { filename: string; subfolder: string; type: string }): Promise<string> {
    const { filename, subfolder, type } = imageData;
    const searchParams = new URLSearchParams({
      filename,
      subfolder: subfolder || '',
      type: type || 'output'
    });

    const viewUrl = `${this.baseUrl}/view?${searchParams.toString()}`;
    const response = await fetch(viewUrl);

    if (!response.ok) {
      throw new RenderAdapterError(`Failed to fetch image from ${viewUrl}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const safeFilename = `${randomUUID()}_${filename}`;
    const localFilePath = path.join(this.outputDir, safeFilename);

    await fs.writeFile(localFilePath, buffer);

    return localFilePath;
  }
}
