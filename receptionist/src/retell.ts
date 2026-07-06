const BASE_URL = "https://api.retellai.com";

export async function retellRequest<T = any>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RETELL_API_KEY environment variable is not set. Get a key from https://dashboard.retellai.com (Settings → API Keys)."
    );
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Retell API ${method} ${path} failed (HTTP ${res.status}): ${detail}`);
  }

  // DELETE endpoints return no body
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export interface RetellLlmResponse {
  llm_id: string;
}

export interface RetellAgentResponse {
  agent_id: string;
}

export interface RetellPhoneNumberResponse {
  phone_number: string;
  phone_number_pretty?: string;
}

export const retell = {
  createLlm: (payload: object) => retellRequest<RetellLlmResponse>("POST", "/create-retell-llm", payload),
  updateLlm: (llmId: string, payload: object) =>
    retellRequest<RetellLlmResponse>("PATCH", `/update-retell-llm/${llmId}`, payload),

  createAgent: (payload: object) => retellRequest<RetellAgentResponse>("POST", "/create-agent", payload),
  updateAgent: (agentId: string, payload: object) =>
    retellRequest<RetellAgentResponse>("PATCH", `/update-agent/${agentId}`, payload),

  buyPhoneNumber: (payload: object) =>
    retellRequest<RetellPhoneNumberResponse>("POST", "/create-phone-number", payload),
  updatePhoneNumber: (phoneNumber: string, payload: object) =>
    retellRequest<RetellPhoneNumberResponse>(
      "PATCH",
      `/update-phone-number/${encodeURIComponent(phoneNumber)}`,
      payload
    ),
};
