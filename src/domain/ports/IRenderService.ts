export interface IRenderService {
  renderImage(imagePrompt: string): Promise<string>;
}
