import { openai } from "@/app/openai";

export const runtime = "nodejs";
// Augmenter la durée maximale de la fonction serverless
export const maxDuration = 60; // 60 secondes au lieu des 10 secondes par défaut

// Send a new message to a thread
export async function POST(request, { params: { threadId } }) {
  try {
    const { toolCallOutputs, runId } = await request.json();

    const stream = openai.beta.threads.runs.submitToolOutputsStream(
      threadId,
      runId,
      // { tool_outputs: [{ output: result, tool_call_id: toolCallId }] },
      { tool_outputs: toolCallOutputs }
    );

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
