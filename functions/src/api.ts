import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

// Fetch Claude API key from Functions config
function getClaudeKey(): string {
  const key = functions.config().claude?.key;
  if (!key) throw new Error('Claude API key not configured');
  return key;
}

// Fetch Judge0 credentials from Functions config
function getJudge0Config(): { host: string; apiKey: string } {
  const host = functions.config().judge0?.host || 'https://judge0-ce.p.rapidapi.com';
  const apiKey = functions.config().judge0?.key;
  if (!apiKey) throw new Error('Judge0 API key not configured');
  return { host, apiKey };
}

export async function callClaude(messages: any[], model = 'claude-sonnet-4-20250514') {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': getClaudeKey(),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'dangerously-allow-html-user-override': 'true',
    } as any,
    body: JSON.stringify({ model, max_tokens: 1000, messages, system: '' }),
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Claude API error ${response.status}: ${txt}`);
  }
  return response.json();
}

export async function runJudge0(code: string, language: string) {
  const { host, apiKey } = getJudge0Config();
  const response = await fetch(`${host}/submissions?base64_encoded=true&wait=true`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': host.replace('https://', ''),
    } as any,
    body: JSON.stringify({ source_code: Buffer.from(code).toString('base64'), language_id: language }),
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Judge0 API error ${response.status}: ${txt}`);
  }
  return response.json();
}
