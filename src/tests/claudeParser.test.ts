import { describe, test, expect } from 'vitest';
import { parseClaudeResponse } from '../utils/claudeParser';

describe('parseClaudeResponse', () => {
  test('handles valid JSON correctly', () => {
    const json = JSON.stringify({
      correctness: 8,
      efficiency: 9,
      communication: 7,
      strengths: ['Good variables', 'Clean syntax'],
      improvements: ['Consider recursion'],
      overall_summary: 'Overall good job'
    });
    const parsed = parseClaudeResponse(json);
    expect(parsed.correctness).toBe(8);
    expect(parsed.efficiency).toBe(9);
    expect(parsed.communication).toBe(7);
    expect(parsed.strengths).toContain('Good variables');
    expect(parsed.overall_summary).toBe('Overall good job');
  });

  test('handles malformed JSON gracefully by returning defaults', () => {
    const malformed = '{"correctness": 8, "efficiency": 9, ... malformed text';
    const parsed = parseClaudeResponse(malformed);
    expect(parsed.correctness).toBe(7); // default value
    expect(parsed.strengths).toEqual([]);
    expect(parsed.overall_summary).toBe('');
  });

  test('handles missing fields by merging with defaults', () => {
    const partial = JSON.stringify({
      correctness: 9,
      strengths: ['Great work']
    });
    const parsed = parseClaudeResponse(partial);
    expect(parsed.correctness).toBe(9);
    expect(parsed.efficiency).toBe(7); // default value
    expect(parsed.strengths).toContain('Great work');
    expect(parsed.improvements).toEqual([]);
  });

  test('cleans markdown block wrapper if present', () => {
    const mdJson = `\`\`\`json
    {
      "correctness": 9,
      "efficiency": 8,
      "communication": 8,
      "strengths": ["test"],
      "improvements": [],
      "overall_summary": "summary"
    }
    \`\`\``;
    const parsed = parseClaudeResponse(mdJson);
    expect(parsed.correctness).toBe(9);
    expect(parsed.overall_summary).toBe('summary');
  });
});
