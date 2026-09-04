import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '../stores/caseStore';
import { speak, stopSpeaking } from '../lib/nvidia-nim';
import { motion } from 'framer-motion';

export default function Accusation() {
  const navigate = useNavigate();
  const { currentCase } = useCaseStore();
  const [suspectNameQuery, setSuspectNameQuery] = useState('');
  const [theory, setTheory] = useState('');
  const [muted, setMuted] = useState(localStorage.getItem('cold-case-ai-muted') === 'true');

  useEffect(() => {
    speak("Prepare the official indictment. Enter the suspect's name and detail your motive and method theory.");
    return () => stopSpeaking();
  }, []);

  if (!currentCase) {
    navigate('/');
    return null;
  }

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    localStorage.setItem('cold-case-ai-muted', nextMuted ? 'true' : 'false');
    if (nextMuted) {
      stopSpeaking();
    } else {
      speak("Audio feedback enabled.");
    }
  };

  const handleSubmit = () => {
    const query = suspectNameQuery.trim().toLowerCase();
    if (!query) {
      alert('Please type the name of the suspect you wish to indict.');
      return;
    }

    // Match suspect by typed name from new characters array
    const suspect = currentCase.characters.find(s => 
      s.name.toLowerCase().includes(query) || 
      query.includes(s.name.toLowerCase())
    );

    if (!suspect) {
      speak("Alert. No person matching that name resides in current records.");
      alert(`No suspect matches the name "${suspectNameQuery}". Please review your suspects list and type a valid name.`);
      return;
    }

    if (theory.trim().length < 20) {
      speak("Your forensic theory is too brief. Elaborate on the motive and method.");
      alert('Your forensic theory must be at least 20 characters.');
      return;
    }

    stopSpeaking();
    // In the new MasterCase characters schema, we look for isCulprit boolean
    const isCorrect = suspect.isCulprit === true;
    
    // Save verdict into local store
    useCaseStore.setState(state => ({
      ...state,
      score: isCorrect ? state.score + 500 : Math.max(0, state.score - 200),
      gamePhase: 'verdict',
      // Store in case store for compatibility
      conversations: {
        ...state.conversations,
        verdict: [{
          role: 'system',
          content: JSON.stringify({ suspectName: suspect.name, theory, correct: isCorrect }),
          timestamp: new Date().toLocaleTimeString()
        }]
      }
    }));
    
    navigate('/verdict');
  };

  return (
    <div className="relative z-10" style={{ padding: '40px 16px', maxWidth: '700px', margin: '0 auto', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
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
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        transition={{ duration: 0.5 }}
        className="folder"
        style={{ width: '100%', borderTop: '16px solid var(--blood-red)' }}
      >
        {/* Stamp */}
        <div style={{ position: 'absolute', top: '24px', right: '24px', border: '3px double var(--blood-red)', color: 'var(--blood-red)', padding: '6px 12px', transform: 'rotate(-4deg)', fontFamily: 'var(--font-title)', fontWeight: 'bold', fontSize: '0.9rem', letterSpacing: '0.1em' }}>
          OFFICIAL INDICTMENT
        </div>

        <h2 className="typewriter-text glow-text-red" style={{ fontSize: '1.8rem', color: '#1a1712', marginBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.15)', paddingBottom: '12px', marginTop: '24px', fontWeight: 'bold' }}>
          ACQUITTAL & INDICTMENT
        </h2>
        
        <p className="font-typewriter" style={{ color: '#555', fontSize: '0.85rem', marginBottom: '28px', lineHeight: 1.5 }}>
          Draft the formal charges. Point out the primary culprit by typing their name and outline the motive and method backed by the collected evidence. Proceeding with a false accusation will trigger a penalty of 200 points.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label className="typewriter-text" style={{ display: 'block', marginBottom: '10px', color: '#1a1712', fontWeight: 'bold', fontSize: '1rem' }}>
              INDICTABLE SUSPECT (TYPE NAME):
            </label>
            <input 
              type="text"
              value={suspectNameQuery}
              onChange={e => setSuspectNameQuery(e.target.value)}
              placeholder="Type suspect name (e.g., 'John' or 'Sarah Jennings')..."
              style={{ 
                width: '100%', 
                padding: '12px 16px', 
                backgroundColor: 'rgba(0,0,0,0.04)', 
                color: '#111', 
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-typewriter)',
                fontSize: '0.95rem',
                borderRadius: 0,
                outline: 'none'
              }}
            />
            <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>
              Known suspects: {currentCase.characters.map(s => s.name).join(', ')}
            </div>
          </div>

          <div>
            <label className="typewriter-text" style={{ display: 'block', marginBottom: '10px', color: '#1a1712', fontWeight: 'bold', fontSize: '1rem' }}>
              CRIMINAL THEORY (METHOD & MOTIVE):
            </label>
            <textarea 
              value={theory}
              onChange={e => setTheory(e.target.value)}
              rows={6}
              style={{ 
                width: '100%', 
                padding: '16px', 
                backgroundColor: 'rgba(0,0,0,0.04)', 
                color: '#111', 
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-typewriter)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                borderRadius: 0,
                outline: 'none'
              }}
              placeholder="Explain how the suspect did it, what key evidence connects them to the murder, and why..."
            />
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-secondary" 
              onClick={() => navigate('/investigation')}
              style={{ flex: 1, padding: '14px', border: '1px solid var(--border)', color: '#333' }}
            >
              RETURN
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-danger" 
              onClick={() => {
                if (confirm("Verify accusation details? Wrong accusations cost 200 points.")) {
                  handleSubmit();
                }
              }}
              style={{ flex: 2, padding: '14px', fontSize: '1rem' }}
            >
              SUBMIT INDICTMENT
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
