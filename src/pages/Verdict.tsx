import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '../stores/caseStore';
import { speak, stopSpeaking, chat } from '../lib/nvidia-nim';
import { motion } from 'framer-motion';

export default function Verdict() {
  const navigate = useNavigate();
  const { currentCase, resetGame, cluesFound, evidenceAnalyzed, conversations, lawyeredUp, hintsUsed, score, detectiveRank } = useCaseStore();
  const [muted, setMuted] = useState(localStorage.getItem('cold-case-ai-muted') === 'true');
  const [newspaperArticle, setNewspaperArticle] = useState('Generating local news dispatch...');
  const [generatingArticle, setGeneratingArticle] = useState(true);

  // Retrieve accusation details
  const verdictInfo = conversations.verdict?.[0]?.content ? JSON.parse(conversations.verdict[0].content) : null;
  const isCorrect = verdictInfo?.correct ?? false;
  const accusedName = verdictInfo?.suspectName ?? 'Unknown Suspect';

  useEffect(() => {
    if (!currentCase) {
      navigate('/');
      return;
    }

    // 1. Generate AI Newspaper story on load
    const generateNewspaperStory = async () => {
      setGeneratingArticle(true);
      const systemPrompt = `You are a leading crime journalist writing a front-page news article.
Case Title: "${currentCase.title}" (Category: ${currentCase.type}, Difficulty: ${currentCase.difficulty}).
The detective accused: "${accusedName}". Correct solution: ${isCorrect ? 'YES' : 'NO'}.
Detective's indictment theory: "${verdictInfo?.theory || 'No theory provided.'}"
Actual truth: "${currentCase.actualTruth}"

Write a highly engaging, front-page newspaper column reporting on the conclusion of this investigation. Use atmospheric crime reporter language. Keep it to 2-3 paragraphs. Do not use markdown, just output clean paragraphs.`;
      
      try {
        const articleText = await chat(systemPrompt, [{ role: 'user', content: 'Write the newspaper column.' }]);
        setNewspaperArticle(articleText);
        speak(isCorrect ? "Newspaper report generated. Case solved successfully." : "Newspaper report generated. Case remains archived.");
      } catch (e) {
        console.error(e);
        setNewspaperArticle(`Local dispatch reports: The case of ${currentCase.title} has concluded. Details have been filed in public records.`);
      } finally {
        setGeneratingArticle(false);
      }
    };
    generateNewspaperStory();

    const saveVerdictStats = () => {
      try {
        const solvedStr = localStorage.getItem('stats_solved_count');
        const failedStr = localStorage.getItem('stats_failed_count');
        let sCount = solvedStr ? parseInt(solvedStr) : 0;
        let fCount = failedStr ? parseInt(failedStr) : 0;
        if (isCorrect) {
          sCount += 1;
          localStorage.setItem('stats_solved_count', sCount.toString());
        } else {
          fCount += 1;
          localStorage.setItem('stats_failed_count', fCount.toString());
        }
      } catch (e) {
        console.warn('Could not update stats', e);
      }
    };
    saveVerdictStats();

    return () => stopSpeaking();
  }, [currentCase, navigate]);

  if (!currentCase) return null;

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    localStorage.setItem('cold-case-ai-muted', nextMuted ? 'true' : 'false');
    if (nextMuted) {
      stopSpeaking();
    } else {
      speak("Verdict audio resumed.");
    }
  };

  return (
    <div className="relative z-10" style={{ padding: '40px 16px', maxWidth: '900px', margin: '0 auto', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <div className="grain-overlay"></div>
      
      {/* Audio toggle */}
      <button 
        onClick={toggleMute}
        className="btn-secondary"
        style={{ position: 'absolute', top: '20px', right: '20px', padding: '6px 12px', fontSize: '0.72rem', zIndex: 1000 }}
      >
        {muted ? '🔇 MUTED' : '🔊 VOICE ON'}
      </button>

      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }} 
        animate={{ opacity: 1, scale: 1 }} 
        transition={{ duration: 0.6 }}
        style={{ 
          background: '#eae1cb', 
          color: '#1c1917', 
          width: '100%', 
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          border: '10px double #4a3c31',
          padding: '28px',
          fontFamily: 'var(--font-typewriter)'
        }}
      >
        {/* Newspaper masthead */}
        <div style={{ textAlign: 'center', borderBottom: '4px solid #1c1917', paddingBottom: '12px', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'var(--font-title)', fontSize: '2.5rem', fontWeight: '900', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            THE DAILY CHRONICLE
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1c1917', borderBottom: '1px solid #1c1917', padding: '4px 10px', fontSize: '0.72rem', marginTop: '6px' }}>
            <span>June 23, 2026</span>
            <span style={{ fontWeight: 'bold' }}>METROPOLIS INTAKE ARCHIVES</span>
            <span>PRICE: 5 CENTS</span>
          </div>
        </div>

        {/* Headline */}
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 'bold', 
          textAlign: 'center', 
          textTransform: 'uppercase', 
          lineHeight: '1.2', 
          marginBottom: '20px',
          fontFamily: 'var(--font-title)',
          color: isCorrect ? '#196f3d' : '#8b0000'
        }}>
          {isCorrect 
            ? `CASE SOLVED: DETECTIVE INDICTS ${accusedName.toUpperCase()}!` 
            : `TRAGEDY: DETECTIVE TARGETS INNOCENT CIVILIAN!`}
        </h1>

        {/* Columns grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', borderBottom: '2px solid #1c1917', paddingBottom: '20px', marginBottom: '24px' }}>
          
          {/* Column A: Article Text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem', lineHeight: '1.5', textAlign: 'justify' }}>
            {generatingArticle ? (
              <div className="skeleton-loading" style={{ width: '100%', height: '180px' }} />
            ) : (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {newspaperArticle}
              </div>
            )}
            
            <div style={{ borderTop: '1px dashed #4a3c31', paddingTop: '10px', marginTop: '10px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '6px' }}>CASE ACTUAL TRUTH:</div>
              <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#555' }}>
                "{currentCase.actualTruth}"
              </div>
            </div>
          </div>

          {/* Column B: Image & Scorecard */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Establishing Shot Photo */}
            <div style={{ border: '2px solid #1c1917', padding: '6px', background: '#fff' }}>
              {currentCase.sceneImage ? (
                <img src={currentCase.sceneImage} alt="establishing scene" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
              ) : (
                <div style={{ height: '200px', background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Photo Available</div>
              )}
              <div style={{ fontSize: '0.62rem', textAlign: 'center', fontStyle: 'italic', marginTop: '6px' }}>
                Establishing capture of crime scene locale.
              </div>
            </div>

            {/* Scorecard inside paper */}
            <div style={{ background: '#1c140e', color: '#eae1cb', padding: '16px', border: '1px solid #4a3424' }}>
              <h3 style={{ color: 'var(--police-yellow)', margin: '0 0 12px 0', fontSize: '0.92rem', fontFamily: 'var(--font-title)' }}>
                CREDENTIAL RECORD
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.72rem', fontFamily: 'var(--font-ui)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Clues cataloged ({cluesFound.length})</span>
                  <span>+{cluesFound.length * 20}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Forensics processed ({evidenceAnalyzed.length})</span>
                  <span>+{evidenceAnalyzed.length * 25}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>NPCs interrogated ({Object.keys(conversations).length})</span>
                  <span>+{Object.keys(conversations).length * 15}</span>
                </div>
                {lawyeredUp.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f1948a' }}>
                    <span>Fifth Amendment Pleaders ({lawyeredUp.length})</span>
                    <span>-{lawyeredUp.length * 100}</span>
                  </div>
                )}
                {hintsUsed > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f1948a' }}>
                    <span>Hints Consulted ({hintsUsed})</span>
                    <span>-{hintsUsed * 50}</span>
                  </div>
                )}
                
                <div style={{ borderTop: '1px solid #4a3424', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', color: '#fff', fontWeight: 'bold' }}>
                  <span>TOTAL SCORE</span>
                  <span style={{ color: 'var(--police-yellow)' }}>{score} PTS</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--neon-green)' }}>
                  <span>DETECTIVE RANK</span>
                  <span>{detectiveRank.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button 
            className="btn-danger" 
            onClick={() => {
              stopSpeaking();
              resetGame();
              navigate('/');
            }}
            style={{ padding: '12px 32px' }}
          >
            RETURN TO PRECINCY DOSSIER
          </button>
        </div>
      </motion.div>
    </div>
  );
}
