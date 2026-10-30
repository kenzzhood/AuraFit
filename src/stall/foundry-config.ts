export type FoundryConfig = {
  live: boolean;
  endpoint: string | null;
  apiKey: string | null;
  deployment: string | null;
  apiVersion: string;
};

function real(value: string | undefined): string | null {
  const text = value?.trim() ?? "";
  if (!text) return null;
  if (/YOUR_|changeme|placeholder|replace-me/i.test(text)) return null;
  return text;
}

function first(...values: (string | undefined)[]): string | null {
  for (const value of values) {
    const found = real(value);
    if (found) return found;
  }
  return null;
}

/** Normalize a portal URL into the Azure OpenAI deployment base used by the SDK. */
export function foundryDeploymentBase(endpoint: string, deployment: string): string {
  let base = endpoint.trim().split("?")[0].replace(/\/+$/, "");
  base = base.replace(/\/openai\/deployments\/[^/]+(?:\/images\/[^/]*)?$/i, "");
  base = base.replace(/\/openai$/i, "");
  base = base.replace(/\/images\/edits$/i, "");
  return `${base}/openai/deployments/${deployment}`;
}

export function readFoundryConfig(
  env: NodeJS.ProcessEnv = process.env
): FoundryConfig {
  const endpoint = first(
    env.AZURE_FOUNDRY_ENDPOINT,
    env.AZURE_OPENAI_IMAGE_ENDPOINT,
    env.AZURE_OPENAI_ENDPOINT
  );
  const apiKey = first(
    env.AZURE_FOUNDRY_API_KEY,
    env.AZURE_OPENAI_IMAGE_API_KEY,
    env.AZURE_OPENAI_API_KEY
  );
  const deployment = first(
    env.AZURE_FOUNDRY_IMAGE_DEPLOYMENT,
    env.AZURE_OPENAI_IMAGE_DEPLOYMENT,
    env.AZURE_OPENAI_DEPLOYMENT_IMAGE
  );
  const apiVersion =
    first(env.AZURE_FOUNDRY_API_VERSION, env.AZURE_OPENAI_IMAGE_API_VERSION) ??
    "2025-04-01-preview";
  const forcedDemo = env.AUTOFIT_FORCE_DEMO === "true";
  const live = Boolean(endpoint && apiKey && deployment) && !forcedDemo;
  return { live, endpoint, apiKey, deployment, apiVersion };
}
