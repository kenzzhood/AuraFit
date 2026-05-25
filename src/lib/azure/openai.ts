import OpenAI from "openai";

function azureClientForDeployment(deploymentName: string): OpenAI {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion =
    process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-01-preview";
  if (!endpoint || !apiKey) {
    throw new Error("Missing AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY");
  }
  return new OpenAI({
    apiKey,
    baseURL: `${endpoint.replace(/\/$/, "")}/openai/deployments/${deploymentName}`,
    defaultQuery: { "api-version": apiVersion },
    defaultHeaders: { "api-key": apiKey },
  });
}

export function getChatClient(): OpenAI {
  const d = process.env.AZURE_OPENAI_DEPLOYMENT_GPT4O ?? "gpt-4o";
  return azureClientForDeployment(d);
}

export function getEmbeddingClient(): OpenAI {
  const d =
    process.env.AZURE_OPENAI_DEPLOYMENT_EMBED ?? "text-embedding-3-large";
  return azureClientForDeployment(d);
}
