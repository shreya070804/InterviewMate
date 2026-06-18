import { httpsCallable } from 'firebase/functions';
import { firebaseFunctions, MOCK_MODE } from '../firebase';

// Helpers to simulate the responses in mock mode
const simulateFeedback = async (data: any) => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  if (data.type === 'voice') {
    return {
      data: {
        content: [{
          text: JSON.stringify({
            clarity_score: 8,
            structure_score: 7,
            filler_word_count: 2,
            feedback: "Great structure and flow. Good use of the STAR method to address the behavioral question.",
            confidence_score: 9,
            pace_assessment: "ideal",
            specific_feedback: "Pacing is excellent at around 140 WPM. Tone is natural and confident."
          })
        }]
      }
    };
  } else {
    return {
      data: {
        content: [{
          text: JSON.stringify({
            correctness: 8,
            efficiency: 9,
            communication: 7,
            strengths: ["Clean code design", "Optimal time complexity"],
            improvements: ["Add input edge-case validation", "Use expressive variable names"],
            overall_summary: "The solution successfully solves the problem within the optimal time bounds using a sliding window."
          })
        }]
      }
    };
  }
};

const simulateQuestions = async (data: any) => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  const category = (data.jobRole || '').toUpperCase().includes('FRONTEND') ? 'Frontend' : 'DSA';
  return {
    data: {
      content: [{
        text: JSON.stringify([
          {
            title: `Implement a Promise pool in JS`,
            description: "Design a function that limits concurrent execution of async tasks.",
            difficulty: data.difficulty || 'Medium',
            category
          },
          {
            title: "Optimize a high-throughput search autocomplete",
            description: "Design a system that suggests matching queries under high concurrency.",
            difficulty: data.difficulty || 'Medium',
            category: 'System Design'
          },
          {
            title: "STAR: Tell me about a time you resolved a major bug",
            description: "Demonstrate your debugging skills and communication under pressure.",
            difficulty: 'Easy',
            category: 'HR'
          }
        ])
      }]
    }
  };
};

const simulateSummary = async (data: any) => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  if (data.type === 'weakness') {
    return {
      data: {
        content: [{
          text: JSON.stringify({
            weak_areas: [
              {
                category: "System Design",
                avg_score: 5.5,
                study_topics: ["API Gateways & Load Balancing", "Caching Strategies & Redis", "Database Sharding"]
              },
              {
                category: "DSA",
                avg_score: 6.2,
                study_topics: ["Dynamic Programming", "Graph Traversals (DFS/BFS)", "Tries"]
              }
            ]
          })
        }]
      }
    };
  } else {
    return {
      data: {
        content: [{
          text: JSON.stringify({
            what_was_attempted: "The candidate attempted to build a two-sum lookup using a hashmap.",
            what_went_well: "The sliding window approach was implemented cleanly.",
            biggest_gap: "Missed checking for null/empty lists at the start.",
            top_study_topic: "Hash Maps & Arrays",
            estimated_readiness: 75
          })
        }]
      }
    };
  }
};

const simulateSoloInterviewer = async (data: any) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // If this is the difficulty evaluation (usually checks last message for difficulty signal)
  const isDifficultyEval = data.messages && data.messages.length > 0 && 
    data.messages[data.messages.length - 1].content.includes('should the next question be easier, the same, or harder');

  if (isDifficultyEval) {
    return {
      data: {
        content: [{
          text: "same"
        }]
      }
    };
  }

  // Conversation response
  const historyCount = data.messages ? data.messages.filter((h: any) => h.role === 'user').length : 1;
  let text = '';
  if (historyCount === 1) {
    text = `Hi there! I'm Alex. Let's get started. I would like you to solve: "Write a function to find the length of the longest substring without repeating characters." Please code your solution and explain your thought process first.`;
  } else if (historyCount === 2) {
    text = `That sounds like a solid starting idea. How do you plan to optimize the lookup time to O(N)? Consider using a sliding window technique. Write out some code and run it to test your logic.`;
  } else if (historyCount === 3) {
    text = `I see your solution coming together. How does it handle edge cases, like empty strings or single character inputs? Make sure you check for those before finishing.`;
  } else {
    text = `Excellent effort. Your implementation is clean and handles standard edge cases. We can wrap up here. Please click the "End Session" button to receive your mock feedback details and PDF scorecard.`;
  }

  return {
    data: {
      content: [{
        text
      }]
    }
  };
};

// Real vs Mock Callable functions
export const runCodeCallable = !MOCK_MODE && firebaseFunctions
  ? httpsCallable(firebaseFunctions, 'runCode')
  : async (_data: any) => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      return {
        data: {
          stdout: "Mock stdout: Hello, World!\n",
          stderr: "",
          compile_output: "",
          status: { id: 3, description: "Accepted" }
        }
      };
    };

export const generateFeedbackCallable = !MOCK_MODE && firebaseFunctions
  ? httpsCallable(firebaseFunctions, 'generateFeedback')
  : simulateFeedback;

export const generateQuestionsCallable = !MOCK_MODE && firebaseFunctions
  ? httpsCallable(firebaseFunctions, 'generateQuestions')
  : simulateQuestions;

export const generateSummaryCallable = !MOCK_MODE && firebaseFunctions
  ? httpsCallable(firebaseFunctions, 'generateSummary')
  : simulateSummary;

export const soloInterviewerResponseCallable = !MOCK_MODE && firebaseFunctions
  ? httpsCallable(firebaseFunctions, 'soloInterviewerResponse')
  : simulateSoloInterviewer;
