import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '../stores/caseStore';
import { speak, stopSpeaking } from '../lib/nvidia-nim';
import { motion } from 'framer-motion';

export default function CaseBriefing() {
  const navigate = useNavigate();
  const { currentCase, setCurrentCase, setGamePhase } = useCaseStore();
  
  const [imageGenerating, setImageGenerating] = useState(false);
  const [sceneUrl, setSceneUrl] = useState<string>('');
  const [muted, setMuted] = useState(localStorage.getItem('cold-case-ai-muted') === 'true');

  useEffect(() => {
    if (!currentCase) {
      navigate('/');
      return;
    }

    // 1. Voice Narration of Briefing
    const runBriefingTTS = async () => {
      const summaryText = `Dossier #${currentCase.caseId} opened. Title: ${currentCase.title}. Briefing: ${currentCase.summary}. Setting is ${currentCase.location.specificPlace} in ${currentCase.location.city}. Review case data and begin.`;
      await speak(summaryText);
    };
    const ttsTimer = setTimeout(runBriefingTTS, 600);

    // 2. Load Establishing Crime Scene image from Unsplash
    const runImageGeneration = async () => {
      if (currentCase.sceneImage) {
        setSceneUrl(currentCase.sceneImage);
        return;
      }
      setImageGenerating(true);
      try {
        const url = `https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=600`;
        setSceneUrl(url);
        // Save back to case store so it persists
        setCurrentCase({
          ...currentCase,
          sceneImage: url
        });
      } catch (err) {
        console.error(err);
      } finally {
        setImageGenerating(false);
      }
    };
    runImageGeneration();

    return () => {
      clearTimeout(ttsTimer);
      stopSpeaking();
    };
  }, [currentCase, navigate]);

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    localStorage.setItem('cold-case-ai-muted', nextMuted ? 'true' : 'false');
    if (nextMuted) {
      stopSpeaking();
    } else {
      speak("Audio briefing resumed.");
    }
  };

  if (!currentCase) return null;

  return (
    <div className="relative z-10" style={{ padding: '40px 16px', minHeight: '100vh' }}>
      <div className="grain-overlay"></div>
      
      {/* Settings control top-right */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000 }}>
        <button 
          onClick={toggleMute}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.72rem', background: 'var(--panel-bg)' }}
        >
          {muted ? '🔇 MUTED' : '🔊 VOICE ON'}
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, rotateX: 10, y: 30 }} 
        animate={{ opacity: 1, rotateX: 0, y: 0 }} 
        transition={{ duration: 0.7 }}
        className="folder"
        style={{ maxWidth: '850px', width: '100%', borderTop: '16px solid var(--manila-dark)', margin: '0 auto' }}
      >
        {/* Top Confidential Stamp */}
        <div style={{ 
          position: 'absolute', 
          top: '24px', 
          right: '24px', 
          border: '3px double var(--blood-red)', 
          color: 'var(--blood-red)', 
          padding: '6px 12px', 
          transform: 'rotate(6deg)', 
          fontFamily: 'var(--font-title)', 
          fontWeight: 'bold', 
          fontSize: '0.85rem', 
          letterSpacing: '0.12em' 
        }}>
          CONFIDENTIAL DOSSIER
        </div>

        <h2 className="typewriter-text glow-text-red" style={{ fontSize: '1.8rem', borderBottom: '2px solid rgba(0,0,0,0.15)', paddingBottom: '12px', margin: '24px 0 8px 0', color: '#1a1712', textTransform: 'uppercase', fontWeight: 'bold' }}>
          CASE FILE: {currentCase.title}
        </h2>
        <p className="typewriter-text" style={{ fontStyle: 'italic', color: 'var(--blood-red)', fontSize: '1.05rem', margin: '0 0 28px 0', opacity: 0.9 }}>
          "Dossier ID: {currentCase.caseId} · Category: {currentCase.type.toUpperCase()} · Level: {currentCase.difficulty.toUpperCase()}"
        </p>
        
        <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
          {/* Text Description */}
          <div style={{ flex: '2 1 350px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.92rem', color: '#2c251e', lineHeight: '1.6' }}>
            <h3 className="typewriter-text" style={{ margin: '0 0 10px 0', fontSize: '1.25rem', borderBottom: '1px dashed rgba(0,0,0,0.2)', paddingBottom: '6px', fontWeight: 'bold' }}>
              INITIAL BRIEFING
            </h3>
            <p style={{ margin: 0, fontStyle: 'italic' }}>
              "{currentCase.summary}"
            </p>
            <div style={{ whiteSpace: 'pre-wrap', marginTop: '10px', fontSize: '0.88rem' }}>
              {currentCase.fullBriefing}
            </div>

            <h3 className="typewriter-text" style={{ margin: '16px 0 10px 0', fontSize: '1.25rem', borderBottom: '1px dashed rgba(0,0,0,0.2)', paddingBottom: '6px', fontWeight: 'bold' }}>
              INCIDENT LOCATION
            </h3>
            <p style={{ margin: 0 }}>
              <strong>Setting:</strong> {currentCase.location.specificPlace}, {currentCase.location.city} ({currentCase.location.country})
            </p>
            <p style={{ margin: 0, fontStyle: 'italic' }}>
              "{currentCase.location.description}"
            </p>
          </div>

          {/* Crime Scene Photo Placeholder/Generated */}
          <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ 
              background: '#fbfbfb', 
              padding: '12px 12px 36px 12px', 
              boxShadow: '3px 8px 24px rgba(0,0,0,0.3)', 
              border: '1px solid rgba(0,0,0,0.06)',
              transform: 'rotate(-2deg)',
              width: '210px'
            }}>
              {/* Photo Display */}
              <div style={{ 
                width: '186px', 
                height: '186px', 
                background: '#1a1f2e', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid #1a1a1a'
              }}>
                {imageGenerating ? (
                  <div className="skeleton-loading" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eae1cb', padding: '16px', textAlign: 'center', fontSize: '0.65rem' }}>
                    Fetching scene establish image...
                  </div>
                ) : sceneUrl ? (
                  <img src={sceneUrl} alt="Crime Scene Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-narrative)', color: '#555', fontSize: '0.72rem', marginTop: '16px', fontWeight: 'bold', textAlign: 'center' }}>
                ESTABLISHING SHOT
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <motion.button 
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="btn-danger" 
            onClick={() => {
              stopSpeaking();
              setGamePhase('investigating');
              navigate('/investigation');
            }}
            style={{ fontSize: '1rem', padding: '12px 32px' }}
          >
            BEGIN INVESTIGATION
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
