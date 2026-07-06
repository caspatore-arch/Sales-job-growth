import { readFileSync } from "node:fs";

export interface Faq {
  q: string;
  a: string;
}

export interface ClientConfig {
  business: {
    name: string;
    industry: string;
    hours: string;
    address?: string;
    services: string[];
    faqs?: Faq[];
  };
  voice?: {
    voice_id?: string;
    greeting?: string;
  };
  actions?: {
    booking_link?: string;
    transfer_number?: string;
    webhook_url?: string;
  };
  phone?: {
    area_code?: string;
  };
  /** Optional Retell LLM model override, e.g. "gpt-4o-mini". Omit to use Retell's default. */
  llm_model?: string;
}

const E164 = /^\+[1-9]\d{6,14}$/;

export function loadClientConfig(path: string): ClientConfig {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`Cannot read config file: ${path}`);
  }

  let cfg: any;
  try {
    cfg = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${path} is not valid JSON: ${(err as Error).message}`);
  }

  const errors: string[] = [];
  const requireString = (value: unknown, field: string) => {
    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`"${field}" must be a non-empty string`);
    }
  };

  if (typeof cfg !== "object" || cfg === null || Array.isArray(cfg)) {
    throw new Error(`${path} must contain a JSON object`);
  }

  const biz = cfg.business;
  if (typeof biz !== "object" || biz === null) {
    errors.push(`"business" object is required`);
  } else {
    requireString(biz.name, "business.name");
    requireString(biz.industry, "business.industry");
    requireString(biz.hours, "business.hours");
    if (biz.address !== undefined) requireString(biz.address, "business.address");
    if (!Array.isArray(biz.services) || biz.services.length === 0) {
      errors.push(`"business.services" must be a non-empty array of strings`);
    } else {
      biz.services.forEach((s: unknown, i: number) => requireString(s, `business.services[${i}]`));
    }
    if (biz.faqs !== undefined) {
      if (!Array.isArray(biz.faqs)) {
        errors.push(`"business.faqs" must be an array of { q, a } objects`);
      } else {
        biz.faqs.forEach((f: any, i: number) => {
          requireString(f?.q, `business.faqs[${i}].q`);
          requireString(f?.a, `business.faqs[${i}].a`);
        });
      }
    }
  }

  const actions = cfg.actions;
  if (actions !== undefined) {
    if (actions.booking_link !== undefined && !/^https:\/\/\S+$/.test(actions.booking_link)) {
      errors.push(`"actions.booking_link" must be an https:// URL`);
    }
    if (actions.webhook_url !== undefined && !/^https:\/\/\S+$/.test(actions.webhook_url)) {
      errors.push(`"actions.webhook_url" must be an https:// URL`);
    }
    if (actions.transfer_number !== undefined && !E164.test(actions.transfer_number)) {
      errors.push(`"actions.transfer_number" must be in E.164 format, e.g. +14155551234`);
    }
  }

  if (cfg.phone?.area_code !== undefined && !/^\d{3}$/.test(String(cfg.phone.area_code))) {
    errors.push(`"phone.area_code" must be a 3-digit US area code, e.g. "415"`);
  }

  if (cfg.llm_model !== undefined) requireString(cfg.llm_model, "llm_model");
  if (cfg.voice?.voice_id !== undefined) requireString(cfg.voice.voice_id, "voice.voice_id");
  if (cfg.voice?.greeting !== undefined) requireString(cfg.voice.greeting, "voice.greeting");

  if (errors.length > 0) {
    throw new Error(`Invalid client config ${path}:\n  - ${errors.join("\n  - ")}`);
  }

  return cfg as ClientConfig;
}
