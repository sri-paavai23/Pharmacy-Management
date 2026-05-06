import { pipeline, env } from '@huggingface/transformers';

// Ensure we don't try to use browser-only features in Node
if (typeof window === 'undefined') {
  env.allowLocalModels = false;
}

type EmbedderFunc = (text: string, options?: Record<string, unknown>) => Promise<{ data: Float32Array | number[] }>;
let embedder: EmbedderFunc | null = null;

export async function getEmbedding(text: string) {
  try {
    if (!embedder) {
      console.log("Loading embedding model (Xenova/all-MiniLM-L6-v2)...");
      embedder = (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')) as unknown as EmbedderFunc;
    }
    
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data) as number[];
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}
