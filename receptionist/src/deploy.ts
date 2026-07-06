import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadClientConfig, type ClientConfig } from "./config.js";
import { buildPrompt, type ReceptionistPrompt } from "./prompt.js";
import { retell } from "./retell.js";

interface DeployState {
  llm_id?: string;
  agent_id?: string;
  phone_number?: string;
}

function buildLlmPayload(cfg: ClientConfig, prompt: ReceptionistPrompt): object {
  const tools: object[] = [
    {
      type: "end_call",
      name: "end_call",
      description:
        "End the call politely once the caller's needs are met and their name, callback number, and reason for calling are captured.",
    },
  ];

  if (cfg.actions?.transfer_number) {
    tools.push({
      type: "transfer_call",
      name: "transfer_to_team",
      description:
        "Transfer the caller to a human team member when they ask for a person or the request clearly needs a human.",
      transfer_destination: {
        type: "predefined",
        number: cfg.actions.transfer_number,
      },
    });
  }

  return {
    general_prompt: prompt.generalPrompt,
    begin_message: prompt.beginMessage,
    general_tools: tools,
    ...(cfg.llm_model ? { model: cfg.llm_model } : {}),
  };
}

function buildAgentPayload(cfg: ClientConfig, llmId: string): object {
  return {
    agent_name: `${cfg.business.name} Receptionist`,
    voice_id: cfg.voice?.voice_id ?? "11labs-Adrian",
    response_engine: { type: "retell-llm", llm_id: llmId },
    language: "en-US",
    ...(cfg.actions?.webhook_url ? { webhook_url: cfg.actions.webhook_url } : {}),
    post_call_analysis_data: [
      {
        type: "string",
        name: "caller_name",
        description: "The caller's full name, if they gave one.",
        examples: ["Jane Smith"],
      },
      {
        type: "string",
        name: "callback_number",
        description: "The best callback phone number the caller provided.",
        examples: ["+14155551234"],
      },
      {
        type: "string",
        name: "call_reason",
        description: "One short sentence describing why the caller called.",
        examples: ["Wants to schedule a teeth cleaning next week"],
      },
      {
        type: "boolean",
        name: "appointment_requested",
        description: "True if the caller wanted to book or reschedule an appointment.",
      },
      {
        type: "string",
        name: "message",
        description: "Any message the caller left for the team, verbatim as possible.",
      },
    ],
  };
}

function readState(statePath: string): DeployState {
  if (!existsSync(statePath)) return {};
  return JSON.parse(readFileSync(statePath, "utf8")) as DeployState;
}

function writeState(statePath: string, state: DeployState): void {
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const configPath = args.find((a) => !a.startsWith("--"));

  if (!configPath) {
    console.error("Usage: npx tsx src/deploy.ts <clients/name.json> [--dry-run]");
    process.exit(1);
  }

  const cfg = loadClientConfig(configPath);
  const prompt = buildPrompt(cfg);
  const statePath = configPath.replace(/\.json$/, ".state.json");
  const state = readState(statePath);

  const llmPayload = buildLlmPayload(cfg, prompt);

  if (dryRun) {
    console.log(`--- DRY RUN for ${cfg.business.name} (no API calls made) ---\n`);
    console.log("=== Begin message ===\n" + prompt.beginMessage + "\n");
    console.log("=== System prompt ===\n" + prompt.generalPrompt + "\n");
    console.log("=== Retell LLM payload ===\n" + JSON.stringify(llmPayload, null, 2) + "\n");
    console.log(
      "=== Agent payload (llm_id filled in at deploy time) ===\n" +
        JSON.stringify(buildAgentPayload(cfg, state.llm_id ?? "<created-at-deploy>"), null, 2) +
        "\n"
    );
    console.log(
      "=== Phone number ===\n" +
        (state.phone_number
          ? `Already provisioned: ${state.phone_number}`
          : `Will buy a new number${cfg.phone?.area_code ? ` in area code ${cfg.phone.area_code}` : ""} ($2/mo)`)
    );
    return;
  }

  console.log(`Deploying receptionist for ${cfg.business.name}...`);

  if (state.llm_id) {
    await retell.updateLlm(state.llm_id, llmPayload);
    console.log(`✓ Updated Retell LLM ${state.llm_id}`);
  } else {
    const llm = await retell.createLlm(llmPayload);
    state.llm_id = llm.llm_id;
    writeState(statePath, state);
    console.log(`✓ Created Retell LLM ${state.llm_id}`);
  }

  const agentPayload = buildAgentPayload(cfg, state.llm_id!);
  if (state.agent_id) {
    await retell.updateAgent(state.agent_id, agentPayload);
    console.log(`✓ Updated agent ${state.agent_id}`);
  } else {
    const agent = await retell.createAgent(agentPayload);
    state.agent_id = agent.agent_id;
    writeState(statePath, state);
    console.log(`✓ Created agent ${state.agent_id}`);
  }

  if (state.phone_number) {
    await retell.updatePhoneNumber(state.phone_number, { inbound_agent_id: state.agent_id });
    console.log(`✓ Phone number ${state.phone_number} points at agent ${state.agent_id}`);
  } else {
    const phone = await retell.buyPhoneNumber({
      inbound_agent_id: state.agent_id,
      nickname: `${cfg.business.name} Receptionist`,
      ...(cfg.phone?.area_code ? { area_code: Number(cfg.phone.area_code) } : {}),
    });
    state.phone_number = phone.phone_number;
    writeState(statePath, state);
    console.log(`✓ Bought phone number ${state.phone_number}`);
  }

  console.log(`\nDone. ${cfg.business.name}'s receptionist is live at ${state.phone_number}`);
  console.log(`Test it: call the number, or use a web call from https://dashboard.retellai.com`);
}

main().catch((err) => {
  console.error(`\nDeploy failed: ${(err as Error).message}`);
  process.exit(1);
});
