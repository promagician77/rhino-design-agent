// Production path: the same tool calls, produced by an OpenAI model through the Responses API with strict function
// schemas. Not run in this demo (no key is shipped). tools/eval-llm.mjs scores it on the same instruction sets as the
// offline parser when OPENAI_API_KEY and OPENAI_MODEL are set.
import { TOOLS, SYSTEM_PROMPT } from './tools.js';

const NAMES = new Set(TOOLS.map(t => t.name));

export async function llmParse(text, { apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL, context = '' } = {}) {
  if (!apiKey || !model) throw new Error('Set OPENAI_API_KEY and OPENAI_MODEL');
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      instructions: SYSTEM_PROMPT + (context ? `\nCurrent model state:\n${context}` : ''),
      input: text,
      tools: TOOLS,
      tool_choice: 'required',
      parallel_tool_calls: true,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const calls = [];
  for (const item of data.output || []) {
    if (item.type !== 'function_call') continue;
    if (!NAMES.has(item.name)) continue; // never run a tool we did not offer
    calls.push({ name: item.name, arguments: JSON.parse(item.arguments) });
  }
  return { calls, usage: data.usage };
}

// Short description of the current spec, so "wider" or "back to the previous floor" have something to refer to.
export function contextOf(spec, versions) {
  const z = spec.featureWall.zones.map(z => `${z.id}: ${z.treatment} (${z.material})`).join(', ');
  return [`floor: ${spec.flooring.material}, planks ${spec.flooring.plankWidth} mm`, `feature wall: ${z}`,
    `wardrobe: ${spec.wardrobe.width} x ${spec.wardrobe.depth} x ${spec.wardrobe.height} mm`,
    `saved versions: ${versions.map(v => v.label).join(', ')}`].join('\n');
}
