"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callClaude = callClaude;
exports.runJudge0 = runJudge0;
const node_fetch_1 = require("node-fetch");
const functions = require("firebase-functions");
// Fetch Claude API key from Functions config
function getClaudeKey() {
    const key = functions.config().claude?.key;
    if (!key)
        throw new Error('Claude API key not configured');
    return key;
}
// Fetch Judge0 credentials from Functions config
function getJudge0Config() {
    const host = functions.config().judge0?.host || 'https://judge0-ce.p.rapidapi.com';
    const apiKey = functions.config().judge0?.key;
    if (!apiKey)
        throw new Error('Judge0 API key not configured');
    return { host, apiKey };
}
async function callClaude(messages, model = 'claude-sonnet-4-20250514', system = '', maxTokens = 1000) {
    const response = await (0, node_fetch_1.default)('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': getClaudeKey(),
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'dangerously-allow-html-user-override': 'true',
        },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages, system }),
    });
    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Claude API error ${response.status}: ${txt}`);
    }
    return response.json();
}
async function runJudge0(code, language, options) {
    const { host, apiKey } = getJudge0Config();
    const body = {
        source_code: Buffer.from(code).toString('base64'),
        language_id: language,
    };
    if (options) {
        if (options.cpu_time_limit !== undefined)
            body.cpu_time_limit = options.cpu_time_limit;
        if (options.memory_limit !== undefined)
            body.memory_limit = options.memory_limit;
        if (options.wall_time_limit !== undefined)
            body.wall_time_limit = options.wall_time_limit;
    }
    const response = await (0, node_fetch_1.default)(`${host}/submissions?base64_encoded=true&wait=true`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': host.replace('https://', ''),
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Judge0 API error ${response.status}: ${txt}`);
    }
    return response.json();
}
//# sourceMappingURL=api.js.map