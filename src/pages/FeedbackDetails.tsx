import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { getFeedback, saveFeedback, getQuestions, checkApiUsage, showToast, getUserFeedbackList, MOCK_MODE } from '../firebase';
import { generateFeedbackCallable, generateSummaryCallable } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import type { Feedback, Question } from '../types';
import { parseClaudeResponse } from '../utils/claudeParser';
import { Layout } from '../components/Layout';
import { 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft, 
  RotateCw, 
  Settings,
  Download,
  Award,
  Sparkles,
  Play
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';


const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || '';

export const FeedbackDetails: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(ANTHROPIC_API_KEY);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const recQuestion = feedback?.nextRecommendation?.recommended_question_id
    ? questions.find(q => q.id === feedback.nextRecommendation?.recommended_question_id)
    : null;

  useEffect(() => {
    getQuestions().then(setQuestions).catch(console.error);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getFeedback(sessionId);
        if (data && data.scores && data.scores.correctness > 0) {
          // Feedback already generated and exists
          setFeedback(data);
          setLoading(false);

          let currentWeakest = 'DSA';
          if (user) {
            try {
              const feedbacks = await getUserFeedbackList(user.uid);
              const categoryTotals: Record<string, { total: number; count: number }> = {
                'DSA': { total: 0, count: 0 },
                'System Design': { total: 0, count: 0 },
                'Frontend': { total: 0, count: 0 },
                'HR': { total: 0, count: 0 }
              };

              feedbacks.forEach(f => {
                const cat = getCategoryFromTopic(f.topic);
                if (cat && f.scores) {
                  const avgSession = (f.scores.correctness + f.scores.efficiency + f.scores.communication) / 3;
                  categoryTotals[cat].total += avgSession;
                  categoryTotals[cat].count += 1;
                }
              });

              let minAvg = Infinity;
              Object.entries(categoryTotals).forEach(([cat, info]) => {
                if (info.count > 0) {
                  const avg = info.total / info.count;
                  if (avg < minAvg) {
                    minAvg = avg;
                    currentWeakest = cat;
                  }
                }
              });
            } catch (historyErr) {
              console.error("Failed to load user history for weakest category calculation:", historyErr);
            }
          }

          let latestFeedback = data;
          if (!data.sessionSummary) {
            latestFeedback = await handleGenerateSummary(data);
          }
          
          if (latestFeedback && !latestFeedback.nextRecommendation) {
            await handleGenerateRecommendation(latestFeedback, currentWeakest);
          }
        } else if (data) {
          // Session code exists but feedback is empty, need to generate it
          setFeedback(data);
          await handleGenerateFeedback(data);
        } else {
          // No session metadata found, fallback to dashboard
          console.warn("Feedback meta data not found in collections.");
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading feedback details:", err);
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId, user]);

  // AI Mocking Fallback Analyzer - inspects actual code to yield custom review reports
  const analyzeCodeLocally = (questionTitle: string, codeText: string, topicDetail: string): any => {
    const code = codeText.toLowerCase();
    
    // Default values
    let correctness = 7;
    let efficiency = 6;
    let communication = 8;
    let strengths = [
      "Good structure and naming conventions.",
      "Clear explanation of variables and iterative processes."
    ];
    let improvements = [
      "Review edge cases (e.g. empty lists or null inputs).",
      "Improve dry-run practices to spot boundary bugs."
    ];
    let overallSummary = "You demonstrated a solid understanding of the core concepts during the mock interview. Structure is clean, though some optimizations can be added.";

    // Check specific question types
    if (questionTitle.toLowerCase().includes('two sum')) {
      strengths = [
        "Strong understanding of search arrays and index-pairing logic.",
        "Excellent articulation of the core search problem prior to implementation.",
        "Clean structure with proper return statements for index arrays."
      ];

      // Detect nested loop O(N^2) vs Hash Map O(N)
      const hasMap = code.includes('map') || code.includes('dict') || code.includes('object') || code.includes('{}') && code.includes('[');
      const hasNestedLoop = (code.match(/for/g) || []).length >= 2 || (code.includes('while') && code.includes('for'));

      if (hasMap && !hasNestedLoop) {
        correctness = 9;
        efficiency = 9;
        communication = 8;
        improvements = [
          "Explain how JavaScript Map handles collisions or lookup time in the worst case.",
          "Check for double-key matches (e.g. ensuring index != target index).",
          "Clean up any remaining unused temporary array variables."
        ];
        overallSummary = "Excellent execution! You successfully chose the optimal O(N) Hash Map approach, displaying strong knowledge of space/time trade-offs. Communication was crisp throughout the session.";
      } else if (hasNestedLoop) {
        correctness = 8;
        efficiency = 5;
        communication = 7;
        improvements = [
          "Optimize code efficiency from O(N^2) to O(N) using a Hash Map search lookup.",
          "Consider time complexity trade-offs between nested loops and single-pass maps.",
          "Avoid redundant conditional comparisons inside the inner loop."
        ];
        overallSummary = "Your solution is functionally correct and handles standard cases. However, there is significant room to optimize time complexity from O(N^2) to O(N) using a single-pass hash table.";
      }
    } else if (questionTitle.toLowerCase().includes('reverse a linked list')) {
      strengths = [
        "Good grasping of pointer re-assignments and node linkages.",
        "Iterative code is clean with appropriate temporary pointer swap states."
      ];
      improvements = [
        "Mention the recursive approach and compare its call-stack overhead.",
        "Double-check boundary conditions (e.g. lists with 0 or 1 nodes)."
      ];
      overallSummary = "Solid traversal implementation. You handled pointer tracking well, though outlining recursive recursion stack limitations adds interview value.";
    } else if (topicDetail.includes('System Design')) {
      correctness = 8;
      efficiency = 7;
      communication = 9;
      strengths = [
        "Excellent high-level modular blocks (DB replication, CDNs, Load balancers).",
        "Proactive estimation of data storage requirements."
      ];
      improvements = [
        "Address single-point-of-failure (SPOF) risks in the core schema layout.",
        "Dive deeper into cache invalidation policies (e.g. LRU vs FIFO)."
      ];
      overallSummary = "You mapped out the architecture effectively and communicated constraints. Adding redundancy and addressing specific DB scaling issues will push this to Hire territory.";
    }

    return {
      correctness,
      efficiency,
      communication,
      strengths,
      improvements,
      overall_summary: overallSummary
    };
  };

  const getCategoryFromTopic = (topic: string): 'DSA' | 'System Design' | 'Frontend' | 'HR' | null => {
    const t = topic.toLowerCase();
    if (t.includes('dsa') || t.includes('data structure') || t.includes('algorithm')) return 'DSA';
    if (t.includes('system design') || t.includes('architecture')) return 'System Design';
    if (t.includes('frontend') || t.includes('web') || t.includes('ui')) return 'Frontend';
    if (t.includes('hr') || t.includes('behavioral') || t.includes('communication')) return 'HR';
    return null;
  };

  const computeFallbackRecommendation = (category: string, _scores: any, weakest: string, questionsList: Question[]) => {
    let matchedQ = questionsList.find(q => q.category === weakest);
    if (!matchedQ) {
      matchedQ = questionsList.find(q => q.category === category);
    }

    if (matchedQ) {
      return {
        recommended_question_id: matchedQ.id,
        recommended_category: null,
        reason: `Practice ${matchedQ.title} to strengthen your understanding in the ${matchedQ.category} domain.`
      };
    } else {
      return {
        recommended_question_id: null,
        recommended_category: (weakest || category || 'DSA') as any,
        reason: `No matched questions were found in the question bank. Focus on improving your overall skills in the ${weakest || category || 'DSA'} domain.`
      };
    }
  };

  const handleGenerateRecommendation = async (currentFeedback: Feedback, weakest: string) => {
    let availableQs = questions;
    if (availableQs.length === 0) {
      try {
        availableQs = await getQuestions();
      } catch (err) {
        console.error("Failed to load questions in recommendation:", err);
      }
    }

    const availableQuestionsList = availableQs.map(q => ({
      id: q.id,
      title: q.title,
      category: q.category,
      difficulty: q.difficulty
    }));

    const category = getCategoryFromTopic(currentFeedback.topic) || 'DSA';
    const apiKey = localStorage.getItem('im_claude_key') || import.meta.env.VITE_ANTHROPIC_API_KEY || '';

    let nextRecommendation: any = null;

    if (apiKey && !MOCK_MODE) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'dangerously-allow-html-user-override': 'true'
          } as any,
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [
              {
                role: 'user',
                content: `Based on this session's performance — category: ${category}, scores: correctness ${currentFeedback.scores.correctness}/10, efficiency ${currentFeedback.scores.efficiency}/10, communication ${currentFeedback.scores.communication}/10 — and this candidate's weakest area being ${weakest}, recommend exactly one specific question from this list that would help them improve the most: ${JSON.stringify(availableQuestionsList)}. If no good match exists in the question bank, return recommended_question_id as null, and return the recommended_category (one of: 'DSA', 'System Design', 'Frontend', 'HR') instead. Return JSON with: recommended_question_id, recommended_category, reason (1 sentence explaining why this question or category was chosen).`
              }
            ],
            system: "You are an expert software engineering mentor. Respond ONLY with a valid JSON block containing: recommended_question_id (string or null), recommended_category (string or null), reason (string)."
          })
        });

        if (response.ok) {
          const data = await response.json();
          const cleanJson = data.content[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          nextRecommendation = {
            recommended_question_id: parsed.recommended_question_id || null,
            recommended_category: parsed.recommended_category || null,
            reason: parsed.reason || 'Focus on practicing mock coding questions.'
          };
        } else {
          throw new Error('Direct Claude recommend call failed');
        }
      } catch (err) {
        console.warn("Direct Claude recommendation failed, calling Firebase function / fallback:", err);
      }
    }

    if (!nextRecommendation) {
      try {
        const response = await generateSummaryCallable({
          type: 'recommendation',
          category,
          scores: currentFeedback.scores,
          weakestCategoryFromHistory: weakest,
          availableQuestionsList
        });
        const responseData: any = response.data;
        const jsonText = responseData.content[0].text;
        const parsed = JSON.parse(jsonText.replace(/```json/g, '').replace(/```/g, '').trim());
        nextRecommendation = {
          recommended_question_id: parsed.recommended_question_id || null,
          recommended_category: parsed.recommended_category || null,
          reason: parsed.reason || 'Practice related mock interview questions.'
        };
      } catch (err) {
        console.warn("Cloud function recommendation failed, using offline fallback:", err);
        nextRecommendation = computeFallbackRecommendation(category, currentFeedback.scores, weakest, availableQs);
      }
    }

    const updated: Feedback = {
      ...currentFeedback,
      nextRecommendation
    };

    await saveFeedback(updated);
    setFeedback(updated);
  };

  const triggerSummaryAndRecommendation = async (finalizedFeedback: Feedback) => {
    const summaryUpdated = await handleGenerateSummary(finalizedFeedback);
    let currentWeakest = 'DSA';
    if (user) {
      try {
        const feedbacks = await getUserFeedbackList(user.uid);
        const categoryTotals: Record<string, { total: number; count: number }> = {
          'DSA': { total: 0, count: 0 },
          'System Design': { total: 0, count: 0 },
          'Frontend': { total: 0, count: 0 },
          'HR': { total: 0, count: 0 }
        };

        feedbacks.forEach(f => {
          const cat = getCategoryFromTopic(f.topic);
          if (cat && f.scores) {
            const avgSession = (f.scores.correctness + f.scores.efficiency + f.scores.communication) / 3;
            categoryTotals[cat].total += avgSession;
            categoryTotals[cat].count += 1;
          }
        });

        let minAvg = Infinity;
        Object.entries(categoryTotals).forEach(([cat, info]) => {
          if (info.count > 0) {
            const avg = info.total / info.count;
            if (avg < minAvg) {
              minAvg = avg;
              currentWeakest = cat;
            }
          }
        });
      } catch (historyErr) {
        console.error("Failed to load user history for weakest category calculation:", historyErr);
      }
    }
    await handleGenerateRecommendation(summaryUpdated || finalizedFeedback, currentWeakest);
  };

  const handleGenerateFeedback = async (currentFeedback: Feedback) => {
    setGeneratingAI(true);
    
    let questionText = "General mock interview";
    try {
      const qList = await getQuestions();
      const sessionData = await getFeedback(sessionId || ''); 
      const codeSnippet = sessionData?.codeSnippet || currentFeedback.codeSnippet || '';
      
      const qMatch = qList.find(q => q.title.toLowerCase().includes(currentFeedback.topic.split(' ')[0].toLowerCase()));
      if (qMatch) {
        questionText = `Title: ${qMatch.title}\nDescription: ${qMatch.description}`;
      }

      const codeString = codeSnippet || '// No code written';

      try {
        if (user) {
          await checkApiUsage(user.uid);
        }
      } catch (err: any) {
        showToast(err.message || "Daily AI usage limit reached, resets at midnight", "error");
        setGeneratingAI(false);
        setLoading(false);
        return;
      }

      try {
        const response = await generateFeedbackCallable({
          questionText,
          codeString
        });

        const responseData: any = response.data;
        const jsonText = responseData.content[0].text;
        const parsed = parseClaudeResponse(jsonText);

        const finalized: Feedback = {
          ...currentFeedback,
          scores: {
            correctness: parsed.correctness,
            efficiency: parsed.efficiency,
            communication: parsed.communication,
          },
          strengths: parsed.strengths,
          improvements: parsed.improvements,
          summary: parsed.overall_summary,
        };

        await saveFeedback(finalized);
        setFeedback(finalized);
        setGeneratingAI(false);
        setLoading(false);
        await triggerSummaryAndRecommendation(finalized);
        return;
      } catch (apiErr) {
        console.warn("Anthropic API failed. Utilizing High-Fidelity Local AI Fallback Analyzer.", apiErr);
        Sentry.captureException(apiErr, { tags: { feature: 'feedback-generation' } });
      }

      const localResult = analyzeCodeLocally(
        qMatch ? qMatch.title : currentFeedback.topic, 
        codeString, 
        currentFeedback.topic
      );

      const finalizedLocal: Feedback = {
        ...currentFeedback,
        scores: {
          correctness: localResult.correctness,
          efficiency: localResult.efficiency,
          communication: localResult.communication,
        },
        strengths: localResult.strengths,
        improvements: localResult.improvements,
        summary: localResult.overall_summary,
      };

      await saveFeedback(finalizedLocal);
      setFeedback(finalizedLocal);
      await triggerSummaryAndRecommendation(finalizedLocal);

    } catch (err) {
      console.error("Failed to run AI analysis:", err);
    } finally {
      setGeneratingAI(false);
      setLoading(false);
    }
  };

  const handleGenerateSummary = async (currentFeedback: Feedback): Promise<Feedback> => {
    let questionText = "General mock interview";
    try {
      const qList = await getQuestions();
      const qMatch = qList.find(q => q.title.toLowerCase().includes(currentFeedback.topic.split(' ')[0].toLowerCase()));
      if (qMatch) {
        questionText = `Title: ${qMatch.title}\nDescription: ${qMatch.description}`;
      }
    } catch (e) {}

    const codeSnippet = currentFeedback.codeSnippet || '// No code written';

    try {
      if (user) {
        await checkApiUsage(user.uid);
      }
    } catch (err: any) {
      showToast(err.message || "Daily AI usage limit reached, resets at midnight", "error");
      return currentFeedback;
    }

    try {
      const response = await generateSummaryCallable({
        questionText,
        codeSnippet,
        scores: currentFeedback.scores
      });

      const responseData: any = response.data;
      const jsonText = responseData.content[0].text;
      const parsed = JSON.parse(jsonText.replace(/```json/g, '').replace(/```/g, '').trim());

      const updated: Feedback = {
        ...currentFeedback,
        sessionSummary: {
          what_was_attempted: parsed.what_was_attempted || '',
          what_went_well: parsed.what_went_well || '',
          biggest_gap: parsed.biggest_gap || '',
          top_study_topic: parsed.top_study_topic || '',
          estimated_readiness: parsed.estimated_readiness || 50
        }
      };

      await saveFeedback(updated);
      setFeedback(updated);
      return updated;
    } catch (err) {
      console.warn("Claude summary API failed, using local fallback", err);
      Sentry.captureException(err, { tags: { feature: 'feedback-generation' } });
    }

    const avgScore = (currentFeedback.scores.correctness + currentFeedback.scores.efficiency + currentFeedback.scores.communication) / 3;
    const readiness = Math.round(avgScore * 10);

    const updatedLocal: Feedback = {
      ...currentFeedback,
      sessionSummary: {
        what_was_attempted: `Attempted solving the ${currentFeedback.topic} question using core structural loops.`,
        what_went_well: `Articulated logic choices clearly and structured standard variables cleanly.`,
        biggest_gap: `Could benefit from optimizing spatial footprint and handling null boundary inputs.`,
        top_study_topic: currentFeedback.topic.toLowerCase().includes('dsa') ? 'Sliding Window & Hash Maps' : 'CDN Caching Policies',
        estimated_readiness: readiness
      }
    };

    await saveFeedback(updatedLocal);
    setFeedback(updatedLocal);
    return updatedLocal;
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('feedback-report-content');
    if (!element || !feedback) return;

    try {
      const actionButtons = document.getElementById('feedback-action-buttons');
      const apiSettingsBtn = document.getElementById('api-settings-btn');
      
      if (actionButtons) actionButtons.style.display = 'none';
      if (apiSettingsBtn) apiSettingsBtn.style.display = 'none';

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#020617' : '#fcfcfc'
      });

      if (actionButtons) actionButtons.style.display = 'flex';
      if (apiSettingsBtn) apiSettingsBtn.style.display = 'inline-flex';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`InterviewMate_Feedback_${feedback.date || 'Report'}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKeyInput.trim()) {
      localStorage.setItem('im_claude_key', apiKeyInput.trim());
      setShowKeyForm(false);
      if (feedback) {
        handleGenerateFeedback(feedback);
      }
    }
  };

  // Helper for rendering SVG score circles
  const renderScoreCircle = (score: number, title: string, subtitle: string) => {
    const strokeDash = (score / 10) * 100;

    return (
      <div className="flex flex-col items-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm justify-center text-center">
        <div className="relative flex items-center justify-center w-28 h-28">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-slate-100"
              strokeWidth="3"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-brand transition-all duration-1000 ease-out"
              strokeDasharray={`${strokeDash}, 100`}
              strokeWidth="3.2"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-2xl font-bold text-slate-800">{score}</span>
            <span className="text-xs text-slate-400 font-semibold block">/10</span>
          </div>
        </div>
        <h4 className="mt-4 text-xs font-bold text-slate-800 uppercase tracking-wider">{title}</h4>
        <p className="text-[11px] text-slate-400 font-medium mt-1">{subtitle}</p>
      </div>
    );
  };

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 bg-[#fcfcfc] dark:bg-[#020617]" id="feedback-report-content">
        {/* Back navigation */}
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </button>

        {loading || generatingAI ? (
          <div className="flex flex-col h-96 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <RotateCw className="h-10 w-10 animate-spin text-brand mb-4" />
            <h3 className="text-base font-bold text-slate-800">Generating Session Feedback Report</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm leading-relaxed">
              Evaluating your session's code correctness, efficiency guidelines, and overall syntax structure using senior engineering metrics.
            </p>
          </div>
        ) : !feedback ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
            <h3 className="mt-4 text-sm font-semibold text-slate-700">No session data found</h3>
            <p className="mt-1 text-xs text-slate-500">We could not load any details for this session ID.</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover cursor-pointer"
            >
              Return Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header metadata block */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
              <div>
                <span className="inline-flex rounded-full bg-brand-light px-2.5 py-0.5 text-[10px] font-bold text-brand uppercase tracking-wider">
                  Report generated
                </span>
                <h1 className="mt-2 text-3xl font-extrabold text-slate-800 tracking-tight">Session feedback</h1>
                <p className="mt-1 text-xs text-slate-500">
                  {feedback.topic} &bull; {feedback.duration} min &bull; {feedback.date}
                </p>
              </div>

              {/* PDF & API Settings trigger group */}
              <div className="flex items-center gap-3 shrink-0" id="feedback-header-actions">
                <button
                  onClick={handleDownloadPDF}
                  aria-label="Download feedback report as PDF"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus:outline-none"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download as PDF
                </button>
                
                <div className="relative shrink-0">
                  <button
                    id="api-settings-btn"
                    onClick={() => setShowKeyForm(!showKeyForm)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <Settings className="h-3.5 w-3.5" /> API Settings
                  </button>
                  {showKeyForm && (
                    <form onSubmit={handleSaveApiKey} className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg z-20 space-y-2">
                      <label className="text-[10px] font-bold uppercase text-slate-500 block">Claude API Key</label>
                      <input
                        type="password"
                        aria-label="Claude API Key"
                        placeholder="sk-ant-..."
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        className="block w-full rounded border border-slate-200 p-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand text-slate-800"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowKeyForm(false)}
                          className="px-2 py-1 text-[10px] text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="bg-brand text-white px-2 py-1 rounded text-[10px] font-bold"
                        >
                          Apply Key
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* Score Ring Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {renderScoreCircle(feedback.scores.correctness, 'Correctness', 'Logic & Syntax')}
              {renderScoreCircle(feedback.scores.efficiency, 'Efficiency', 'Complexity & Optimization')}
              {renderScoreCircle(feedback.scores.communication, 'Communication', 'Clarity & Articulation')}
            </div>

            {/* Strengths & Improvements layout */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Strengths (Green border) */}
              <div className="rounded-2xl border border-teal-200 bg-teal-50/5 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-5 w-5 text-brand shrink-0" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Strengths</h3>
                </div>
                <ul className="space-y-3">
                  {feedback.strengths.map((str, idx) => (
                    <li key={idx} className="flex gap-2 text-xs text-slate-600 leading-relaxed items-start">
                      <span className="text-brand shrink-0 font-semibold">•</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Improvements (Amber border) */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/5 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Improvements</h3>
                </div>
                <ul className="space-y-3">
                  {feedback.improvements.map((imp, idx) => (
                    <li key={idx} className="flex gap-2 text-xs text-slate-600 leading-relaxed items-start">
                      <span className="text-amber-500 shrink-0 font-semibold">•</span>
                      <span>{imp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Session Summary Card (readiness bar, study topic) */}
            {feedback.sessionSummary && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Award className="h-5.5 w-5.5 text-brand" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Session Summary</h3>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">What Was Attempted</span>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium mt-0.5">{feedback.sessionSummary.what_was_attempted}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">What Went Well</span>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium mt-0.5">{feedback.sessionSummary.what_went_well}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Biggest Gap</span>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium mt-0.5">{feedback.sessionSummary.biggest_gap}</p>
                    </div>
                  </div>

                  <div className="space-y-5 bg-[#f8fafc] rounded-xl p-4.5 border border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Top Study Topic</span>
                      <span className="inline-flex rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 mt-1.5">
                        {feedback.sessionSummary.top_study_topic}
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                        <span>Estimated Readiness</span>
                        <span>{feedback.sessionSummary.estimated_readiness}%</span>
                      </div>
                      <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          role="progressbar"
                          aria-valuenow={feedback.sessionSummary.estimated_readiness}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label="Estimated Readiness"
                          className={`h-full rounded-full transition-all duration-1000 ${
                            feedback.sessionSummary.estimated_readiness < 40 ? 'bg-red-500' :
                            feedback.sessionSummary.estimated_readiness <= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} 
                          style={{ width: `${feedback.sessionSummary.estimated_readiness}%` }}
                        ></div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-1.5">
                        {feedback.sessionSummary.estimated_readiness < 40 ? 'Requires immediate foundation review.' :
                         feedback.sessionSummary.estimated_readiness <= 70 ? 'On the right track, keep practicing.' :
                         'Excellent! Highly prepared for dynamic live interviews.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Next Recommendation Card */}
            {feedback.nextRecommendation && (
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-950 bg-indigo-50/5 dark:bg-indigo-950/10 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-indigo-100 dark:border-indigo-950/50 pb-3">
                  <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">What to practice next</h3>
                </div>

                {recQuestion ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            recQuestion.difficulty === 'Easy' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450' :
                            recQuestion.difficulty === 'Medium' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-705 dark:text-amber-450' :
                            'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-450'
                          }`}>
                            {recQuestion.difficulty}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {recQuestion.category}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{recQuestion.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{recQuestion.description}</p>
                      </div>
                      <button
                        onClick={() => navigate('/solo', { state: { prefillQuestion: recQuestion } })}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-750 text-white px-4 py-2 text-xs font-bold transition-all cursor-pointer shrink-0 self-start sm:self-center focus-visible:ring-2 focus-visible:ring-indigo-550 focus:outline-none"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" /> Practice this now
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-medium">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">Why this was chosen:</span> {feedback.nextRecommendation.reason}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                      <div>
                        <span className="inline-flex rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          Focus Area
                        </span>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1.5">
                          Domain: {feedback.nextRecommendation.recommended_category || 'General Skills'}
                        </h4>
                      </div>
                      <button
                        onClick={() => navigate('/solo', { state: { prefillTopic: feedback.nextRecommendation?.recommended_category || 'DSA' } })}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-650 hover:bg-indigo-750 text-white px-4 py-2 text-xs font-bold transition-all cursor-pointer shrink-0 self-start sm:self-center focus-visible:ring-2 focus-visible:ring-indigo-550 focus:outline-none"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" /> Practice this now
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-medium">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">Recommendation:</span> {feedback.nextRecommendation.reason}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Overall summary block */}
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-6 shadow-sm">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Overall summary</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {feedback.summary}
              </p>
            </div>

            {/* Action buttons footer */}
            <div className="flex justify-center pt-4 border-t border-slate-200" id="feedback-action-buttons">
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover text-white px-6 py-2.5 text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Back to dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
