import { assistantId } from "@/app/assistant-config";
import { openai } from "@/app/openai";

export const runtime = "nodejs";
// Augmenter la durée maximale de la fonction serverless
export const maxDuration = 60; // 60 secondes au lieu des 10 secondes par défaut

// Send a new message to a thread
export async function POST(request, { params: { threadId } }) {
  try {
    const { content } = await request.json();

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: content,
    });

    const stream = openai.beta.threads.runs.stream(threadId, {
      assistant_id: assistantId,
    });

    
    // Ajouter un gestionnaire d'erreur pour le stream
    stream.on('error', (error) => {
      console.error('Stream error:', error);
      // Le stream gère déjà les erreurs, pas besoin d'action supplémentaire
    });

    return new Response(stream.toReadableStream());
  } catch (error) {
    console.error('API route error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Une erreur est survenue lors du traitement de votre demande',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
