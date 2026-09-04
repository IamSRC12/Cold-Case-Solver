import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '../stores/caseStore';
import { chat, speak, stopSpeaking, saveCaseToCloud } from '../lib/nvidia-nim';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge, 
  Handle, 
  Position, 
  ReactFlowProvider
} from '@xyflow/react';
import type { 
  Node as FlowNode,
  Edge as FlowEdge,
  Connection
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Toast Notification component
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { 
    const t = setTimeout(onDone, 2800); 
    return () => clearTimeout(t); 
  }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: 20 }}
      style={{ 
        position: 'fixed', 
        bottom: 24, 
        right: 24, 
        zIndex: 9999, 
        background: 'var(--panel-bg)', 
        color: 'var(--police-yellow)', 
        padding: '12px 20px', 
        fontFamily: 'var(--font-ui)', 
        fontWeight: 'bold', 
        borderRadius: 4, 
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        border: '1px solid var(--border)'
      }}
    >
      {message}
    </motion.div>
  );
}

// React Flow Custom Suspect Node (Polaroid Photo)
function SuspectNode({ data }: { data: any }) {
  return (
    <div 
      className="flow-node-suspect" 
      style={{ 
        borderBottom: '20px solid #fff',
        boxShadow: data.lawyered ? '0 0 10px rgba(139,0,0,0.5)' : '3px 5px 12px rgba(0,0,0,0.5)'
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
      <div style={{ width: '100%', height: '80px', background: 'linear-gradient(135deg, #10141e, #1a2030)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderBottom: '1px solid #ddd' }}>
        {data.image ? (
          <img src={data.image} alt={data.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" style={{ margin: '22px auto' }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </div>
      <div style={{ padding: '6px 4px 0 4px', fontSize: '0.65rem', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {data.name}
      </div>
      <div style={{ fontSize: '0.5rem', color: '#475569', fontStyle: 'italic', marginTop: '0px' }}>
        {data.relationship}
      </div>
      {data.lawyered && (
        <div style={{ color: 'var(--blood-red)', fontSize: '0.45rem', fontWeight: 'bold', marginTop: '1px' }}>
          ⚖️ LAWYERED
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
    </div>
  );
}

// React Flow Custom Evidence Node (Post-It note)
function EvidenceNode({ data }: { data: any }) {
  return (
    <div className={`flow-node-evidence ${data.analyzed ? 'analyzed-node' : ''}`} style={{ width: '150px' }}>
      <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
      <div style={{ fontWeight: 'bold', fontSize: '0.7rem', marginBottom: '2px', textTransform: 'uppercase', color: 'var(--blood-red)' }}>
        {data.name}
      </div>
      <div style={{ fontSize: '0.6rem', color: '#334155', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
        {data.description}
      </div>
      <div style={{ fontSize: '0.5rem', color: '#64748b', fontStyle: 'italic', marginTop: '4px', borderTop: '1px dashed #cbd5e1', paddingTop: '4px' }}>
        Significance: {data.significance}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
    </div>
  );
}

const nodeTypes = {
  suspectNode: SuspectNode,
  evidenceNode: EvidenceNode
};

export default function Investigation() {
  const navigate = useNavigate();
  const { 
    currentCase, 
    setCurrentCase,
    cluesFound, 
    collectClue, 
    analyzeClue, 
    evidenceAnalyzed, 
    conversations, 
    addChatMessage, 
    confrontSuspect, 
    lawyeredUp,
    boardNodes,
    boardEdges,
    setBoardNodes,
    setBoardEdges,
    playerNotes,
    setPlayerNotes,
    timeLeft,
    timerActive,
    updateTimer,
    setTimerActive,
    hintsUsed,
    useHint,
    score,
    addScore,
    detectiveRank,
    calculateRank,
    chatMode,
    setChatMode,
    activeNPCId,
    setActiveNPCId,
    cloudSaved,
    setCloudSaved,
    accusationsCount
  } = useCaseStore();

  const [activeLocation, setActiveLocation] = useState<string>('');
  const [interrogationQuery, setInterrogationQuery] = useState('');
  const [activeRightTab, setActiveRightTab] = useState<'clues' | 'suspects' | 'locations' | 'timeline'>('clues');
  
  const [isTyping, setIsTyping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [muted, setMuted] = useState(localStorage.getItem('cold-case-ai-muted') === 'true');
  const [isListening, setIsListening] = useState(false);
  
  // Location established image loaders
  const [locImageLoading, setLocImageLoading] = useState(false);
  const [characterImageLoading, setCharacterImageLoading] = useState<Record<string, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);

  // React Flow Handlers
  const onNodesChange = useCallback(
    (changes: any) => setBoardNodes(applyNodeChanges(changes, boardNodes)),
    [boardNodes, setBoardNodes]
  );

  const onEdgesChange = useCallback(
    (changes: any) => setBoardEdges(applyEdgeChanges(changes, boardEdges)),
    [boardEdges, setBoardEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const customEdge: FlowEdge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        style: { stroke: 'var(--blood-red)', strokeWidth: 3 },
        animated: false
      };
      setBoardEdges(addEdge(customEdge, boardEdges));
    },
    [boardEdges, setBoardEdges]
  );

  // Sync timer countdown
  useEffect(() => {
    let t: any = null;
    if (timerActive && timeLeft > 0) {
      t = setInterval(() => {
        updateTimer(1);
      }, 1000);
    }
    return () => clearInterval(t);
  }, [timerActive, timeLeft]);

  // Handle low-time TTS alerts
  useEffect(() => {
    if (timerActive && timeLeft > 0 && timeLeft < 300 && timeLeft % 60 === 0) {
      speak(`Warning. Only ${Math.floor(timeLeft / 60)} minutes remaining to archive findings.`);
    }
  }, [timeLeft, timerActive]);

  // Handle game timeout
  useEffect(() => {
    if (timerActive && timeLeft <= 0) {
      speak("Investigation failed. Time has run out. Your archives have been locked.");
      showToast("⏳ Warning: Time has expired! Concluding session.");
      setTimerActive(false);
      navigate('/verdict');
    }
  }, [timeLeft, timerActive, navigate]);

  // Initial location setups
  useEffect(() => {
    if (currentCase) {
      if (currentCase.locations?.length > 0) {
        setActiveLocation(currentCase.locations[0].name);
      }
    } else {
      navigate('/');
    }
  }, [currentCase]);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, chatMode, activeNPCId]);

  if (!currentCase) return null;

  const showToast = (msg: string) => setToast(msg);

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    localStorage.setItem('cold-case-ai-muted', nextMuted ? 'true' : 'false');
    if (nextMuted) {
      stopSpeaking();
    } else {
      speak("Voice synthesizer enabled.");
    }
  };

  // 1. Web Speech API Voice Input
  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.onstart = () => {
      setIsListening(true);
      speak("Voice input active. Speak now.");
    };
    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInterrogationQuery(transcript);
    };
    rec.onend = () => {
      setIsListening(false);
    };
    rec.start();
  };

  // 2. Cloud Save integration using LocalStorage
  const handleCloudSave = async () => {
    const stateData = useCaseStore.getState();
    const success = await saveCaseToCloud(currentCase.caseId, stateData);
    if (success) {
      setCloudSaved(true);
      showToast("💾 Case files synchronized to LocalStorage.");
      speak("Case files successfully synchronized to cloud file cabinet.");
    } else {
      showToast("⚠️ Cloud save failed. Saved locally instead.");
    }
  };

  // 3. Location Travel and establishing photo synthesis
  const handleTravel = async (locName: string) => {
    stopSpeaking();
    setActiveLocation(locName);
    const locObj = currentCase.locations.find(l => l.name === locName);
    if (!locObj) return;

    speak(`Traveling to ${locName}. ${locObj.description}`);
    showToast(`📍 Traveled to: ${locName}`);

    // If location establishing photo doesn't exist, synthesize it
    if (!locObj.image) {
      setLocImageLoading(true);
      try {
        const locUrl = `https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=600`;
        locObj.image = locUrl;
        
        const updatedLocs = currentCase.locations.map(l => l.name === locName ? { ...l, image: locUrl } : l);
        setCurrentCase({
          ...currentCase,
          locations: updatedLocs
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLocImageLoading(false);
      }
    }
  };

  // 4. Suspect Interrogation Portrait Synthesis
  const handleSynthesizePortrait = async (charName: string) => {
    const char = currentCase.characters.find(c => c.name === charName);
    if (!char || char.image) return;

    setCharacterImageLoading(prev => ({ ...prev, [charName]: true }));
    try {
      const charUrl = `https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=600`;
      char.image = charUrl;

      const updatedChars = currentCase.characters.map(c => c.name === charName ? { ...c, image: charUrl } : c);
      setCurrentCase({
        ...currentCase,
        characters: updatedChars
      });
      showToast(`📸 Polaroid generated for ${char.name}.`);
    } catch (e) {
      console.error(e);
    } finally {
      setCharacterImageLoading(prev => ({ ...prev, [charName]: false }));
    }
  };

  // 5. Forensics Lab Evidence Portrait Synthesis
  const handleSynthesizeEvidencePhoto = async (evidenceId: string) => {
    const ev = currentCase.evidence.find(e => e.id === evidenceId);
    if (!ev || ev.image) return;

    showToast(`🔬 Generating forensic photo for evidence: ${ev.name}`);
    try {
      const evUrl = `https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=600`;
      ev.image = evUrl;
      const updatedEv = currentCase.evidence.map(e => e.id === evidenceId ? { ...e, image: evUrl } : e);
      setCurrentCase({
        ...currentCase,
        evidence: updatedEv
      });
      showToast(`🔬 Forensic photo completed.`);
    } catch (e) {
      console.error(e);
    }
  };

  // 6. Dynamic multi-mode chat processor (The core prompt parser)
  const handleChatMessageSubmit = async () => {
    if (!interrogationQuery.trim()) return;
    const userMsg = interrogationQuery.trim();
    setInterrogationQuery('');

    // Determine context label
    const conversationId = chatMode === 'npc' ? `npc_${activeNPCId}` : chatMode;
    
    // Add User message
    addChatMessage(conversationId, { role: 'user', content: userMsg });
    setIsTyping(true);

    const rawHistory = conversations[conversationId] || [];
    // Convert to OpenAI standard messages format and append the current user query
    const cleanHistory = [
      ...rawHistory.map(h => ({ role: h.role === 'user' ? 'user' as const : 'assistant' as const, content: h.content })),
      { role: 'user' as const, content: userMsg }
    ];

    const npcName = chatMode === 'npc' ? activeNPCId : '';
    
    // Compile System Prompt
    let modeInstructions = '';
    if (chatMode === 'partner') {
      modeInstructions = `You are the user's AI detective partner helping analyze the case files and theories.
Collaborate, discuss alibis, suggest paths, and bounce ideas. Do not solve the case for them directly. Challenge incorrect theories diplomatically.`;
    } else if (chatMode === 'npc') {
      const npc = currentCase.characters.find(c => c.name === activeNPCId);
      if (npc) {
        modeInstructions = `You are roleplaying as ${npc.name}, a ${npc.role} in this case.
Personality: ${npc.personality}
Visual/behavior description: ${npc.description}
Known facts (you can share freely): ${npc.knownFacts.join(', ')}
Hidden facts (you only reveal if asked a specific, correct question): ${npc.hiddenFacts.join(', ')}
Is culprit: ${npc.isCulprit}. If you are the culprit, lie evasively but leave slight alibi slip-ups if pushed hard. If innocent, speak truthfully but you might hide personal secrets.
Do NOT reveal you are an AI. Stay in character 100%.`;
      } else {
        modeInstructions = `Roleplay as the active suspect/witness.`;
      }
    } else if (chatMode === 'forensics') {
      modeInstructions = `You are a professional forensics lab expert. Analyze the evidence items in the case data.
Explain chemical details, finger print analysis, digital logs, or autopsy reports. Give scientific, objective explanations.`;
    } else if (chatMode === 'consultant') {
      modeInstructions = `You are a senior case consultant giving strategic advice on detective methodology. Guide the user on how to gather timelines, find alibis, and construct proof.`;
    } else if (chatMode === 'hint') {
      modeInstructions = `You are giving hints. Difficulty context is: ${currentCase.difficulty}.
Provide progressive hints. Do not spoil the final culprit directly. Vague for Inspector/Chief, helpful for Rookie.`;
    }

    const systemPrompt = `You are part of the Crime Case Investigation App.
Case Data:
- ID: ${currentCase.caseId}
- Title: ${currentCase.title}
- Briefing: ${currentCase.fullBriefing}
- Case Type: ${currentCase.type}
- Hidden Clues available in case: ${currentCase.hiddenClues.join(', ')}
- Total timeline: ${JSON.stringify(currentCase.timeline)}
- Evidence profiles: ${JSON.stringify(currentCase.evidence)}

Active Conversation Mode: "${chatMode}" ${npcName ? `Interrogating Character: ${npcName}` : ''}
Instructions for this mode:
${modeInstructions}

General Rules:
1. Stay immersive and atmospheric.
2. Keep responses 2-5 sentences for general chat. Interrogations or forensic reviews can be slightly longer.
3. React with appropriate tension or breakthroughs.
4. Use special tags in your response to trigger game events:
   - [CLUE DISCOVERED] when the user discovers or unlocks one of the hidden clues: ${currentCase.hiddenClues.join(', ')}. Include this tag EXACTLY once when they successfully extract it.
   - [BREAKTHROUGH] when a major alibi slips or connection is verified.
   - [THEORY CHALLENGED] when the user proposes a theory that is incorrect.
   - [COLD TRAIL] when user hits a dead end or unsolvable element.
   - [CASE CLOSED] when user successfully solves the case (details match actual culprit and method).`;

    try {
      const response = await chat(systemPrompt, cleanHistory);
      if (response) {
        addChatMessage(conversationId, { role: 'assistant', content: response });
        speak(response);

        // Process special tags
        if (response.includes('[CLUE DISCOVERED]')) {
          showToast("🔍 [CLUE DISCOVERED] New file appended to Locker!");
          currentCase.hiddenClues.forEach(hc => {
            if (response.toLowerCase().includes(hc.toLowerCase()) || response.includes('[CLUE DISCOVERED]')) {
              const matchingEv = currentCase.evidence.find(ev => ev.name.toLowerCase().includes(hc.toLowerCase()) || hc.toLowerCase().includes(ev.name.toLowerCase()));
              if (matchingEv) {
                collectClue(matchingEv.id);
              }
            }
          });
        }
        if (response.includes('[BREAKTHROUGH]')) {
          showToast("✨ [BREAKTHROUGH] Major discovery! +100 Score!");
          addScore(100);
        }
        if (response.includes('[THEORY CHALLENGED]')) {
          showToast("⚠️ [THEORY CHALLENGED] Your hypothesis has logical gaps.");
        }
        if (response.includes('[COLD TRAIL]')) {
          showToast("❄️ [COLD TRAIL] The trace goes cold.");
        }
        if (response.includes('[CASE CLOSED]')) {
          showToast("🏆 [CASE CLOSED] You solved the case correctly!");
          speak("Congratulations, Detective. Case closed. Proceeding to verdict.");
          addScore(500);
          setTimeout(() => navigate('/verdict'), 3500);
        }
      }
    } catch (err) {
      console.error(err);
      showToast("⚠️ Communication link disrupted.");
    } finally {
      setIsTyping(false);
      calculateRank();
    }
  };

  // progressive hints
  const handleRequestHint = () => {
    useHint();
    speak("Consulting files. Appending hint to transcript.");
    addChatMessage(chatMode === 'npc' ? `npc_${activeNPCId}` : chatMode, {
      role: 'assistant',
      content: `[HINT CONSULTATION] Detective hint: ${currentCase.difficulty_hints[currentCase.difficulty]?.[0] || 'Observe alibi timelines carefully and cross-reference locations.'}`
    });
  };

  // Sync React Flow nodes
  const syncEvidenceBoard = useCallback(() => {
    const updatedNodes: FlowNode[] = [];
    
    // Add characters
    currentCase.characters.forEach((suspect, idx) => {
      const existing = boardNodes.find(n => n.id === suspect.name);
      updatedNodes.push({
        id: suspect.name,
        type: 'suspectNode',
        position: existing?.position || { x: 50, y: idx * 160 + 50 },
        data: { 
          name: suspect.name, 
          relationship: suspect.role,
          isGuilty: suspect.isCulprit,
          lawyered: lawyeredUp.includes(suspect.name),
          image: suspect.image
        }
      });
    });

    // Add clues found
    cluesFound.forEach((eid, idx) => {
      const ev = currentCase.evidence.find(e => e.id === eid);
      if (!ev) return;
      const existing = boardNodes.find(n => n.id === eid);
      updatedNodes.push({
        id: eid,
        type: 'evidenceNode',
        position: existing?.position || { x: 320, y: idx * 150 + 50 },
        data: {
          name: ev.name,
          description: ev.description,
          significance: ev.significance,
          analyzed: evidenceAnalyzed.includes(eid)
        }
      });
    });

    setBoardNodes(updatedNodes);
  }, [currentCase, cluesFound, evidenceAnalyzed, boardNodes, lawyeredUp, setBoardNodes]);

  useEffect(() => {
    if (activeRightTab === 'clues') {
      syncEvidenceBoard();
    }
  }, [activeRightTab, cluesFound, evidenceAnalyzed, lawyeredUp]);

  const activeLocationObj = currentCase.locations.find(l => l.name === activeLocation);

  // Time conversion
  const formatTime = (secs: number) => {
    if (secs > 100000) return 'No Time Limit';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Check if timer is low for pulsing warning class
  const isTimeLow = timeLeft < 300 && timerActive;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '12px', gap: '12px', background: 'var(--bg)', position: 'relative' }}>
      <div className="grain-overlay"></div>
      
      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast key={toast + Date.now()} message={toast} onDone={() => setToast(null)} />}
      </AnimatePresence>

      {/* Case Header */}
      <div className="glass-panel" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="pulsing-dot"></div>
            <div className="typewriter-text" style={{ fontSize: '1.25rem', color: 'var(--police-yellow)', fontWeight: 'bold', fontFamily: 'var(--font-title)' }}>
              {currentCase.title.toUpperCase()}
            </div>
            <span style={{ fontSize: '0.62rem', background: 'var(--surface-accent)', padding: '2px 6px', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>
              {currentCase.caseId}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>
            Rank: <span style={{ color: 'var(--police-yellow)' }}>{detectiveRank} ({score} pts)</span> · Category: {currentCase.type.toUpperCase()}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={toggleMute} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.68rem' }}>
            {muted ? '🔇 MUTED' : '🔊 VOICE'}
          </button>
          
          <button onClick={handleCloudSave} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.72rem', background: 'var(--surface-accent)', color: 'var(--neon-green)', borderColor: 'var(--neon-green)' }}>
            {cloudSaved ? '☁️ SYNCED' : '☁️ CLOUD SAVE'}
          </button>

          <button onClick={() => navigate('/accusation')} className="btn-danger" style={{ padding: '8px 16px', fontSize: '0.78rem' }}>
            INDICTMENT
          </button>
        </div>
      </div>

      {/* Main 3-Column Workspace */}
      <div style={{ flex: 1, display: 'flex', gap: '12px', overflow: 'hidden' }}>
        
        {/* COLUMN 1: Case Details Panel (Left) */}
        <div className={`glass-panel ${isTimeLow ? 'low-time-pulse' : ''}`} style={{ width: '220px', display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', overflowY: 'auto', transition: 'all 0.5s' }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 'bold', letterSpacing: '0.08em', marginBottom: '4px' }}>TIMER LIMIT</div>
            <div className="font-typewriter" style={{ fontSize: '1.4rem', color: timeLeft < 300 ? 'var(--blood-red)' : 'var(--police-yellow)', fontWeight: 'bold' }}>
              {formatTime(timeLeft)}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 'bold', marginBottom: '6px' }}>DIFFICULTY</div>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text)' }}>
              {currentCase.difficulty}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 'bold', marginBottom: '6px' }}>CASE SYNOPSIS</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', lineHeight: 1.4, maxHeight: '180px', overflowY: 'auto' }}>
              {currentCase.summary}
            </div>
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <button onClick={handleRequestHint} className="btn-secondary" style={{ width: '100%', padding: '8px', fontSize: '0.72rem' }}>
              REQUEST HINT ({hintsUsed})
            </button>
          </div>
        </div>

        {/* COLUMN 2: Main Investigation & Chat Console (Center) */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflow: 'hidden' }}>
          
          {/* Top Panel: Photo and Scene establish */}
          <div className="glass-panel" style={{ display: 'flex', gap: '16px', padding: '16px', background: 'var(--panel-bg)', minHeight: '160px' }}>
            <div style={{ width: '120px', height: '120px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden', background: '#0b0f19', flexShrink: 0 }}>
              {locImageLoading ? (
                <div className="skeleton-loading" style={{ width: '100%', height: '100%', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', textAlign: 'center' }}>
                  Drawing location establish...
                </div>
              ) : activeLocationObj?.image ? (
                <img src={activeLocationObj.image} alt={activeLocation} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : currentCase.sceneImage ? (
                <img src={currentCase.sceneImage} alt="establishing scene" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ fontSize: '0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>No visual</div>
              )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.65rem', background: 'var(--blood-red)', padding: '2px 6px', color: '#fff', fontWeight: 'bold' }}>LOCATION</span>
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text)' }}>{activeLocation.toUpperCase()}</div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.4, overflowY: 'auto', maxHeight: '80px' }}>
                "{activeLocationObj?.description || currentCase.location.description}"
              </div>
            </div>
          </div>

          {/* Active Chat console */}
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Chat Header selector */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              {(['partner', 'npc', 'forensics', 'consultant', 'hint'] as const).map(mode => {
                const isActive = chatMode === mode;
                return (
                  <button 
                    key={mode} 
                    onClick={() => setChatMode(mode)} 
                    style={{
                      flex: 1,
                      padding: '10px', 
                      fontFamily: 'var(--font-ui)', 
                      fontWeight: 'bold', 
                      cursor: 'pointer',
                      background: isActive ? 'var(--panel-bg)' : 'transparent',
                      color: isActive ? 'var(--police-yellow)' : 'var(--text-dim)',
                      border: 'none', 
                      borderBottom: isActive ? '2px solid var(--police-yellow)' : '2px solid transparent',
                      transition: 'all 0.15s', 
                      fontSize: '0.68rem', 
                      letterSpacing: '0.05em'
                    }}
                  >
                    {mode.toUpperCase()}
                  </button>
                );
              })}
            </div>

            {/* NPC Selector if mode is Interrogation */}
            {chatMode === 'npc' && (
              <div style={{ display: 'flex', gap: '8px', padding: '10px', borderBottom: '1px solid var(--border)', background: 'var(--surface-accent)', overflowX: 'auto' }}>
                {currentCase.characters.map(char => {
                  const isActive = activeNPCId === char.name;
                  const isLawyered = lawyeredUp.includes(char.name);
                  return (
                    <button
                      key={char.name}
                      onClick={() => setActiveNPCId(char.name)}
                      style={{
                        padding: '6px 12px',
                        background: isActive ? 'var(--police-yellow)' : 'var(--bg)',
                        color: isActive ? 'var(--bg)' : 'var(--text)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 'bold',
                        borderRadius: '3px'
                      }}
                    >
                      {char.name} {isLawyered ? '⚖️' : ''}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Conversation list */}
            <div className="crt-terminal" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', borderBottom: '1px dashed var(--border)', paddingBottom: '6px' }}>
                TRANSCRIPT LOG FEED // MODE: {chatMode.toUpperCase()}
              </div>

              {(conversations[chatMode === 'npc' ? `npc_${activeNPCId}` : chatMode] || []).map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '2px', display: 'flex', gap: 4, alignItems: 'center' }}>
                    {msg.role === 'user' ? 'YOU' : (chatMode === 'npc' ? activeNPCId : `${chatMode.toUpperCase()} FEED`)} · {msg.timestamp}
                    {msg.role !== 'user' && (
                      <button onClick={() => speak(msg.content)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.58rem' }}>🔊</button>
                    )}
                  </div>
                  <div className={msg.role === 'user' ? 'dialogue-detective' : 'dialogue-suspect'}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div style={{ alignSelf: 'flex-start' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: '2px' }}>AI Partner translating alibi details...</div>
                  <div className="dialogue-suspect" style={{ display: 'flex', gap: 4, width: '45px', justifyContent: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Typing input */}
            <div className="terminal-input-container" style={{ margin: '10px' }}>
              <input 
                value={interrogationQuery} 
                onChange={e => setInterrogationQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChatMessageSubmit()}
                placeholder={chatMode === 'npc' && lawyeredUp.includes(activeNPCId) ? 'Suspect has lawyered up.' : 'Type theory, ask NPC questions, or request clues...'}
                disabled={isTyping || (chatMode === 'npc' && lawyeredUp.includes(activeNPCId))}
                className="terminal-input-field"
              />
              
              <button 
                onClick={startVoiceInput}
                disabled={isListening || isTyping}
                className="btn-secondary"
                style={{ padding: '8px 12px', fontSize: '0.8rem', width: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Voice Input"
              >
                {isListening ? '🎙️' : '🎤'}
              </button>

              <button 
                onClick={handleChatMessageSubmit} 
                disabled={isTyping || !interrogationQuery.trim() || (chatMode === 'npc' && lawyeredUp.includes(activeNPCId))}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.78rem' }}
              >
                SUBMIT
              </button>
            </div>
          </div>
        </div>

        {/* COLUMN 3: Evidence Locker & Case Map Pinboard Tabs (Right) */}
        <div className="glass-panel" style={{ width: '330px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Tabs right */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            {(['clues', 'suspects', 'locations', 'timeline'] as const).map(tab => {
              const isActive = activeRightTab === tab;
              return (
                <button 
                  key={tab} 
                  onClick={() => setActiveRightTab(tab)}
                  style={{
                    flex: 1,
                    padding: '8px', 
                    fontFamily: 'var(--font-header)', 
                    fontWeight: 'bold', 
                    cursor: 'pointer',
                    background: isActive ? 'var(--panel-bg)' : 'transparent',
                    color: isActive ? 'var(--police-yellow)' : 'var(--text-dim)',
                    border: 'none', 
                    borderBottom: isActive ? '2px solid var(--police-yellow)' : '2px solid transparent',
                    fontSize: '0.7rem'
                  }}
                >
                  {tab === 'locations' ? '🗺️ MAP' : tab.toUpperCase()}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* TABS 1: Clues Visual Pinboard (React Flow corkboard) */}
            {activeRightTab === 'clues' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>VISUAL CORPINBOARD</div>
                <div style={{ flex: 1, minHeight: '260px', border: '1px solid var(--border)', position: 'relative' }}>
                  <ReactFlowProvider>
                    <ReactFlow
                      nodes={boardNodes}
                      edges={boardEdges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onConnect={onConnect}
                      nodeTypes={nodeTypes}
                      fitView
                    >
                      <Background color="#2a2e38" gap={12} size={1} />
                      <Controls style={{ background: '#eae1cb', border: '1px solid var(--border)', color: '#1c1917' }} />
                    </ReactFlow>
                  </ReactFlowProvider>
                </div>
                
                {/* Collected Evidence List with hover accessibility speak */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {cluesFound.map(eid => {
                    const ev = currentCase.evidence.find(e => e.id === eid);
                    if (!ev) return null;
                    const analyzed = evidenceAnalyzed.includes(eid);
                    return (
                      <div 
                        key={eid} 
                        style={{ border: '1px solid var(--border)', padding: '8px', background: 'var(--bg)', borderRadius: '3px', cursor: 'help' }}
                        onMouseEnter={() => speak(`Clue discovered: ${ev.name}. Description: ${ev.description}`)}
                        onMouseLeave={() => stopSpeaking()}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '0.72rem', color: 'var(--police-yellow)' }}>{ev.name}</span>
                          <span style={{ fontSize: '0.62rem', color: analyzed ? 'var(--neon-green)' : 'var(--text-dim)' }}>
                            {analyzed ? '🔬 ANALYZED' : '⏳ PENDING'}
                          </span>
                        </div>
                        {ev.image && (
                          <img src={ev.image} alt={ev.name} style={{ width: '100%', height: '80px', objectFit: 'cover', marginTop: '6px', border: '1px solid var(--border)' }} />
                        )}
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                          {ev.description}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          {!ev.image && (
                            <button onClick={() => handleSynthesizeEvidencePhoto(eid)} className="btn-secondary" style={{ padding: '2px 6px', fontSize: '0.55rem' }}>
                              📸 GENERATE PHOTO
                            </button>
                          )}
                          {!analyzed && (
                            <button onClick={() => analyzeClue(eid)} className="btn-primary" style={{ padding: '2px 6px', fontSize: '0.55rem' }}>
                              🔬 ANALYZE CLUE
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TABS 2: Suspects Interrogations & polaroids */}
            {activeRightTab === 'suspects' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentCase.characters.map(char => {
                  const isConfronted = accusationsCount[char.name] || 0;
                  const isLawyered = lawyeredUp.includes(char.name);
                  const isCharLoading = characterImageLoading[char.name] || false;
                  return (
                    <div key={char.name} style={{ border: '1px solid var(--border)', padding: '10px', background: 'var(--surface-accent)', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ width: '70px', height: '70px', border: '1px solid var(--border)', background: '#0b0f19', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                          {isCharLoading ? (
                            <div className="skeleton-loading" style={{ width: '100%', height: '100%', fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Creating...</div>
                          ) : char.image ? (
                            <img src={char.image} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <button onClick={() => handleSynthesizePortrait(char.name)} style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.52rem', color: 'var(--text-dim)' }}>
                              <span>📸</span>
                              <span>PHOTO</span>
                            </button>
                          )}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', fontSize: '0.78rem', color: 'var(--police-yellow)' }}>
                            {char.name.toUpperCase()}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                            Role: {char.role} · Personality: {char.personality}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                            "{char.description}"
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>
                          Accused count: {isConfronted}/3 {isLawyered ? '(⚖️ Lawyered)' : ''}
                        </span>
                        <button 
                          onClick={() => confrontSuspect(char.name)}
                          disabled={isLawyered}
                          className="btn-danger"
                          style={{ padding: '3px 8px', fontSize: '0.6rem' }}
                        >
                          CONFRONT SUSPECT
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TABS 3: Locations established visual map */}
            {activeRightTab === 'locations' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>🗺️ INTERACTIVE PLACES MAP</div>
                
                {/* 2D Gridded Coordinate Map representation */}
                <div style={{ position: 'relative', width: '100%', height: '200px', background: '#070a12', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', backgroundImage: 'radial-gradient(rgba(244,169,66,0.06) 1px, transparent 0)', backgroundSize: '16px 16px' }}>
                  {/* Map grid coordinate markings */}
                  <div style={{ position: 'absolute', top: 4, left: 6, fontSize: '0.52rem', color: 'var(--border)', fontFamily: 'var(--font-ui)' }}>SECTOR-X</div>
                  <div style={{ position: 'absolute', bottom: 4, right: 6, fontSize: '0.52rem', color: 'var(--border)', fontFamily: 'var(--font-ui)' }}>2026 Grid</div>
                  
                  {/* Connections */}
                  <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    {currentCase.locations.map((_, i) => {
                      if (i === 0) return null;
                      const x1 = (i * 28) % 70 + 15;
                      const y1 = (i * 32) % 50 + 25;
                      const x2 = ((i - 1) * 28) % 70 + 15;
                      const y2 = ((i - 1) * 32) % 50 + 25;
                      return (
                        <line 
                          key={i} 
                          x1={`${x1}%`} 
                          y1={`${y1}%`} 
                          x2={`${x2}%`} 
                          y2={`${y2}%`} 
                          stroke="rgba(244, 169, 66, 0.25)" 
                          strokeWidth="1" 
                          strokeDasharray="3 3" 
                        />
                      );
                    })}
                  </svg>

                  {/* Nodes */}
                  {currentCase.locations.map((loc, i) => {
                    const isCurrent = activeLocation === loc.name;
                    const x = (i * 28) % 70 + 15;
                    const y = (i * 32) % 50 + 25;
                    return (
                      <div
                        key={loc.name}
                        onClick={() => handleTravel(loc.name)}
                        style={{
                          position: 'absolute',
                          left: `${x}%`,
                          top: `${y}%`,
                          transform: 'translate(-50%, -50%)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          zIndex: 10
                        }}
                      >
                        <div 
                          style={{
                            width: isCurrent ? '12px' : '8px',
                            height: isCurrent ? '12px' : '8px',
                            borderRadius: '50%',
                            background: isCurrent ? 'var(--police-yellow)' : '#334155',
                            border: '1.5px solid #000',
                            boxShadow: isCurrent ? '0 0 6px var(--police-yellow)' : 'none',
                            transition: 'all 0.15s'
                          }} 
                        />
                        <span style={{ 
                          fontSize: '0.52rem', 
                          background: 'rgba(10,14,26,0.85)', 
                          border: isCurrent ? '1px solid var(--police-yellow)' : '1px solid var(--border)', 
                          padding: '1px 3px', 
                          color: isCurrent ? 'var(--police-yellow)' : 'var(--text-dim)',
                          marginTop: '3px',
                          borderRadius: '2px',
                          whiteSpace: 'nowrap'
                        }}>
                          {loc.name}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Plain List details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {currentCase.locations.map(loc => {
                    const isCurrent = activeLocation === loc.name;
                    return (
                      <div 
                        key={loc.name} 
                        style={{ 
                          border: isCurrent ? '1px solid var(--police-yellow)' : '1px solid var(--border)',
                          padding: '8px',
                          background: isCurrent ? 'var(--surface-accent)' : 'var(--bg)',
                          borderRadius: '3px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '0.72rem', color: isCurrent ? 'var(--police-yellow)' : 'var(--text)' }}>
                            {loc.name.toUpperCase()}
                          </span>
                          {!isCurrent && (
                            <button 
                              onClick={() => handleTravel(loc.name)}
                              className="btn-primary" 
                              style={{ padding: '3px 8px', fontSize: '0.6rem' }}
                            >
                              TRAVEL
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                          {loc.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TABS 4: Timeline Events order */}
            {activeRightTab === 'timeline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>TIMELINE RECORD</div>
                {currentCase.timeline.map((evt, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', fontSize: '0.72rem', borderLeft: '2px solid var(--border)', paddingLeft: '10px', marginLeft: '6px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--police-yellow)', flexShrink: 0 }}>
                      {evt.time}
                    </div>
                    <div>
                      <div>{evt.event}</div>
                      <div style={{ fontSize: '0.58rem', color: evt.verified ? 'var(--neon-green)' : 'var(--blood-red)' }}>
                        {evt.verified ? '✓ VERIFIED TIME' : '⏳ UNVERIFIED'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Journal pad */}
          <div style={{ height: '140px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <textarea
              value={playerNotes}
              onChange={e => setPlayerNotes(e.target.value)}
              placeholder="Jot down notes, alibi errors, timeline threads..."
              style={{
                flex: 1,
                padding: '10px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text)',
                fontFamily: 'var(--font-ui)',
                fontSize: '0.72rem',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.4
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
