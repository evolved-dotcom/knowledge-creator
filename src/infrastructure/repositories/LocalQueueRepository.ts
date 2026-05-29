import fs from 'fs/promises';
import path from 'path';

export class QueueRepositoryError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'QueueRepositoryError';
  }
}

export class LocalQueueRepository {
  private readonly filePath: string;

  constructor() {
    this.filePath = path.resolve(process.cwd(), 'src', 'infrastructure', 'data', 'topics_queue.json');
  }

  private async readQueue(): Promise<string[]> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      throw new QueueRepositoryError('Failed to read topics queue from file', error);
    }
  }

  private async writeQueue(queue: string[]): Promise<void> {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(queue, null, 2), 'utf-8');
    } catch (error) {
      throw new QueueRepositoryError('Failed to write topics queue to file', error);
    }
  }

  public async getNextTopic(): Promise<string | null> {
    const queue = await this.readQueue();
    if (queue.length === 0) {
      return null;
    }
    return queue[0];
  }

  public async removeFirstTopic(): Promise<void> {
    const queue = await this.readQueue();
    if (queue.length > 0) {
      queue.shift();
      await this.writeQueue(queue);
    }
  }

  public async getQueueLength(): Promise<number> {
    const queue = await this.readQueue();
    return queue.length;
  }
}
