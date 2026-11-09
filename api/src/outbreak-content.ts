import type { CompanyConfig, Outbreak } from "./types.js";

// Pure text builders for the Scam Vaccine alert and the Knowledge Loop draft.
// They use only stored facts: the masked sender, the distinct-customer count and the company config.
// They do not quote or guess the scam message (message text is never stored) and never promise recovery.

const channels = (config: CompanyConfig) => config.official_channels.join("; ");

// Scam Vaccine: the fake pattern (what is known) next to the real process. Sending is simulated.
export function buildAlertText(config: CompanyConfig, outbreak: Outbreak, customers: number): string {
  return [
    `Heads-up from ${config.display_name} (demo).`,
    `${customers} customers reported messages from ${outbreak.sender_masked}.`,
    `That sender is not one of our official senders.`,
    `How we really contact you: ${channels(config)}.`,
    `Do not call, click or pay from that message.`,
    `If you already paid or shared details, contact your own bank or card provider through their official channel and report it: ${config.fraud_reporting}.`,
  ].join(" ");
}

// Knowledge Loop: a draft article for a person to review and upload by hand. It is a template, not a model output.
export function buildArticleDraft(config: CompanyConfig, outbreak: Outbreak, customers: number): { title: string; markdown: string } {
  const title = `Messages from ${outbreak.sender_masked}: how to check`;
  const markdown = [
    `# ${title}`,
    ``,
    `*Fictional demo content. DRAFT: a person must review and approve it before it is uploaded to eGain knowledge.*`,
    ``,
    `## What customers reported`,
    `${customers} different customers reported messages from the sender ${outbreak.sender_masked}. That sender is not one of the official ${config.display_name} senders.`,
    ``,
    `## How ${config.display_name} really contacts you`,
    ...config.official_channels.map((c) => `- ${c}`),
    ``,
    `## What to do with a message from this sender`,
    `- Do not call, click, install or pay.`,
    `- Check with ${config.display_name} only through the official channels above.`,
    ``,
    `## If you already paid or shared details`,
    `Contact your own bank or card provider through their official channel now. Report it to local fraud reporting: ${config.fraud_reporting}.`,
    ``,
  ].join("\n");
  return { title, markdown };
}
