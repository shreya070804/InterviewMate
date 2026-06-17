export interface ClaudeFeedbackParsed {
  correctness: number;
  efficiency: number;
  communication: number;
  strengths: string[];
  improvements: string[];
  overall_summary: string;
}

export const parseClaudeResponse = (jsonText: string): ClaudeFeedbackParsed => {
  const defaults: ClaudeFeedbackParsed = {
    correctness: 7,
    efficiency: 7,
    communication: 7,
    strengths: [],
    improvements: [],
    overall_summary: ''
  };

  if (!jsonText || typeof jsonText !== 'string') {
    return defaults;
  }

  try {
    // Clean markdown and trim
    const cleanText = jsonText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Parse the JSON
    const parsed = JSON.parse(cleanText);

    // Gracefully merge with defaults to handle missing fields
    return {
      correctness: typeof parsed.correctness === 'number' ? parsed.correctness : defaults.correctness,
      efficiency: typeof parsed.efficiency === 'number' ? parsed.efficiency : defaults.efficiency,
      communication: typeof parsed.communication === 'number' ? parsed.communication : defaults.communication,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : defaults.strengths,
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : defaults.improvements,
      overall_summary: typeof parsed.overall_summary === 'string' 
        ? parsed.overall_summary 
        : (typeof parsed.summary === 'string' ? parsed.summary : defaults.overall_summary)
    };
  } catch (error) {
    console.warn("Failed to parse Claude response:", error);
    return defaults;
  }
};
