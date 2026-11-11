// Scores the OpenAI path on the same instruction sets as the offline parser.
// Usage: OPENAI_API_KEY=... OPENAI_MODEL=... node tools/eval-llm.mjs   (not run for the demo: no key)
import { readFileSync, writeFileSync } from 'node:fs';
import { matches } from './eval-parser.mjs';
import { llmParse } from '../src/agent/llm.js';

const fx = JSON.parse(readFileSync('test/fixtures/instructions.json', 'utf8'));
const out = { model: process.env.OPENAI_MODEL, sets: {} };
for (const set of ['dev', 'holdout']) {
  let correct = 0; const failures = []; let tokens = 0; const ms = [];
  for (const it of fx[set]) {
    const t0 = performance.now();
    const { calls, usage } = await llmParse(it.text);
    ms.push(performance.now() - t0);
    tokens += usage?.total_tokens || 0;
    if (matches(calls, it.expect)) correct++; else failures.push({ text: it.text, got: calls });
  }
  ms.sort((a, b) => a - b);
  out.sets[set] = { total: fx[set].length, correct, failures, tokens, medianMs: Math.round(ms[ms.length >> 1]) };
  console.log(set, `${correct}/${fx[set].length}`, 'median', out.sets[set].medianMs, 'ms', 'tokens', tokens);
}
writeFileSync('data/llm-eval.json', JSON.stringify(out, null, 2));
