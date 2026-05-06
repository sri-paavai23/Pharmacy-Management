import { generateProductEmbeddings } from './src/app/inventory/actions';

async function main() {
  console.log("Generating embeddings...");
  const result = await generateProductEmbeddings();
  console.log("Result:", result);
}

main().catch(console.error).finally(() => process.exit(0));
