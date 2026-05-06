"use server";

import { Groq } from "groq-sdk";
import { getEmbedding } from "@/lib/voice-utils";
import prisma from "@/lib/db";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function voiceSearch(audioFormData: FormData) {
  console.log("=== Voice Search Started ===");
  try {
    const audioFile = audioFormData.get("audio") as File;
    if (!audioFile) throw new Error("No audio file provided");

    // Phase 1: Transcription with a vocabulary prompt for better accuracy
    console.log("Phase 1: Transcribing audio...");
    
    // Fetch a few product names to guide Whisper's vocabulary
    const productSamples = await prisma.product.findMany({
      select: { name: true },
      take: 20
    });
    const vocabularyPrompt = `Pharmacy billing: ${productSamples.map(p => p.name).join(", ")}`;

    const text = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3-turbo",
      response_format: "text",
      prompt: vocabularyPrompt, // Helps Whisper recognize your specific medicines
    }) as unknown as string;

    console.log("Transcription:", text);
    if (!text || text.trim().length === 0) return { transcription: "", items: [] };

    return processVoiceText(text);
  } catch (error) {
    console.error("FATAL Voice Search Error:", error);
    return {
      transcription: "Error occurred during voice processing",
      items: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function processVoiceText(text: string) {
  console.log("=== Process Voice Text ===");
  try {
    // Phase 2: Intent extraction via Groq (MUCH faster than local CPU)
    console.log("Phase 2: Extracting intent via Groq...");
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: `You are a professional pharmacy assistant. 
Extract medicines and quantities from the text. 
Follow these rules:
1. Normalize drug names to their standard generic or brand spelling (e.g., "Pantoprason" -> "Pantoprazole", "Dolo" -> "Dolo").
2. Convert word numbers to digits (e.g., "two" -> 2).
3. If no quantity is mentioned, default to 1.
4. Return ONLY a JSON object: {"items": [{"productName": "...", "quantity": ...}]}` 
        },
        { role: 'user', content: `Text: "${text}"` }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const responseText = chatCompletion.choices[0].message.content || '{"items":[]}';
    console.log("Model output:", responseText);

    let parsedItems: { productName: string; quantity: number }[] = [];
    try {
      const data = JSON.parse(responseText);
      parsedItems = data.items || [];
    } catch {
      parsedItems = [{ productName: text.trim(), quantity: 1 }];
    }

    // Deduplicate parsed items (model sometimes emits same drug twice)
    const seen = new Set<string>();
    parsedItems = parsedItems.filter(item => {
      const key = item.productName?.toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log("Parsed Items:", parsedItems);

    // Phase 3: Sequential matching (NOT parallel — avoids Set race condition)
    console.log("Phase 3: Matching to inventory...");

    // Load all products once for fuzzy fallback
    const allProducts = await prisma.product.findMany({
      select: { id: true, name: true }
    });

    const usedProductIds = new Set<string>(); // deduplication guard
    const finalMatches = [];

    for (const item of parsedItems) {
      const q = (item.productName || "").trim();
      if (!q) continue;

      let matchedProduct: { id: string; name: string } | null = null;

      // ── Strategy 1: Vector/semantic search (only when embeddings exist) ──
      try {
        const embedding = await getEmbedding(q);
        const vectorString = `[${embedding.join(",")}]`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[] = await prisma.$queryRawUnsafe(`
          SELECT id, name,
                 VEC_Distance_Cosine(embedding, VEC_FromText('${vectorString}')) as distance
          FROM product
          WHERE embedding IS NOT NULL
          ORDER BY distance ASC
          LIMIT 10
        `);

        console.log(`Vector candidates for "${q}":`, rows.map(r => ({
          name: r.name,
          distance: typeof r.distance === 'number' ? r.distance.toFixed(4)
                    : r.distance !== null ? String(r.distance)
                    : "null"
        })));

        for (const row of rows) {
          // distance can be BigInt from MySQL driver — normalise it
          let dist: number | null = null;
          if (typeof row.distance === 'number') {
            dist = row.distance;
          } else if (typeof row.distance === 'bigint') {
            dist = Number(row.distance);
          } else if (row.distance !== null && row.distance !== undefined) {
            dist = parseFloat(String(row.distance));
          }

          if (dist !== null && !isNaN(dist) && dist < 0.55 && !usedProductIds.has(row.id)) {
            matchedProduct = { id: row.id, name: row.name };
            console.log(`✓ Vector match for "${q}": "${row.name}" (dist=${dist.toFixed(4)})`);
            break;
          }
        }
      } catch (vecErr) {
        console.warn(`Vector search failed for "${q}", using fuzzy fallback:`, vecErr);
      }

      // ── Strategy 2: Fuzzy name match fallback ──
      if (!matchedProduct) {
        const qLow = q.toLowerCase();
        const qTokens = qLow.split(/\s+/);
        let bestScore = 0;

        for (const prod of allProducts) {
          if (usedProductIds.has(prod.id)) continue;
          const pLow = prod.name.toLowerCase();
          const pTokens = pLow.split(/\s+/);

          // Token overlap score
          const overlap = qTokens.filter(qt =>
            pTokens.some(pt => pt.includes(qt) || qt.includes(pt))
          ).length;
          const tokenScore = overlap / Math.max(qTokens.length, pTokens.length);

          // Character-level similarity (simple prefix/suffix check for typos)
          const charScore = qTokens.some(qt => 
            pTokens.some(pt => {
              if (qt === pt) return true;
              if (qt.length < 4 || pt.length < 4) return false;
              // Check if they share a prefix or if one is a substring of the other with max 2 chars difference
              const minLen = Math.min(qt.length, pt.length);
              let common = 0;
              for(let i=0; i<minLen; i++) if(qt[i] === pt[i]) common++;
              return common / Math.max(qt.length, pt.length) > 0.7;
            })
          ) ? 0.4 : 0;

          // Substring bonus (e.g. "metformin" inside "Metformin 500")
          const subBonus = qLow.includes(pLow) || pLow.includes(qLow) ? 0.5 : 0;

          // Starts-with bonus
          const startsBonus = pLow.startsWith(qTokens[0]) || qLow.startsWith(pTokens[0]) ? 0.2 : 0;

          const score = tokenScore + charScore + subBonus + startsBonus;
          if (score > bestScore && score > 0.4) {
            bestScore = score;
            matchedProduct = { id: prod.id, name: prod.name };
          }
        }

        if (matchedProduct) {
          console.log(`✓ Fuzzy match for "${q}": "${matchedProduct.name}" (score=${bestScore.toFixed(2)})`);
        } else {
          console.log(`✗ No match found for "${q}" — skipping`);
          continue;
        }
      }

      // Guard: never add the same product twice
      if (usedProductIds.has(matchedProduct.id)) {
        console.log(`⚠ Product "${matchedProduct.name}" already matched — skipping duplicate`);
        continue;
      }
      usedProductIds.add(matchedProduct.id);

      // Load batches for matched product
      const product = await prisma.product.findUnique({
        where: { id: matchedProduct.id },
        include: {
          batch: {
            where: { currentStock: { gt: 0 } },
            orderBy: { expiryDate: 'asc' },
            take: 5
          }
        }
      });

      if (!product || product.batch.length === 0) {
        console.log(`⚠ "${matchedProduct.name}" matched but no stock available`);
        continue;
      }

      finalMatches.push({
        product,
        batch: product.batch[0],
        requestedQty: item.quantity || 1,
        score: 0.9
      });
    }

    console.log(`Phase 3 done. Matched ${finalMatches.length}/${parsedItems.length} items.`);
    return { transcription: text, items: finalMatches };

  } catch (error) {
    console.error("FATAL Voice Text Processing Error:", error);
    return {
      transcription: text || "Error occurred during text processing",
      items: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
