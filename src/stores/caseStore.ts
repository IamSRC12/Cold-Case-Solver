import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Node, Edge } from '@xyflow/react';

export interface Character {
  name: string;
  role: 'witness' | 'suspect' | 'victim' | 'official' | 'bystander';
  description: string;
  personality: string;
  knownFacts: string[];
  hiddenFacts: string[];
  isCulprit: boolean | null;
  image?: string; // generated portrait Object URL
}

export interface ClueEvidence {
  id: string;
  name: string;
  type: 'physical' | 'digital' | 'testimonial' | 'circumstantial' | 'forensic';
  description: string;
  significance: 'high' | 'medium' | 'low' | 'misleading';
  imagePrompt: string;
  image?: string; // generated photo Object URL
  analysis_result?: string; // forensic report
}

export interface CaseLocation {
  name: string;
  description: string;
  cluesHere: string[];
  imagePrompt: string;
  image?: string; // generated location establishing image Object URL
}

export interface TimelineEvent {
  time: string;
  event: string;
  verified: boolean;
}

export interface MasterCase {
  caseId: string;
  title: string;
  type: 'criminal' | 'ambiguous' | 'non-criminal' | 'cold' | 'special';
  difficulty: 'rookie' | 'detective' | 'inspector' | 'chief' | 'legend';
  location: {
    city: string;
    country: string;
    specificPlace: string;
    description: string;
  };
  dateReported: string;
  summary: string;
  fullBriefing: string;
  initialClues: string[];
  hiddenClues: string[];
  characters: Character[];
  evidence: ClueEvidence[];
  locations: CaseLocation[];
  timeline: TimelineEvent[];
  possibleConclusions: {
    conclusion: string;
    isCorrect: boolean;
    explanation: string;
  }[];
  actualTruth: string;
  redHerrings: string[];
  difficulty_hints: Record<string, string[]>;
  imagePrompt: string;
  sceneImage?: string;
  caseStatus: string;
  hasCriminal: boolean;
  isResolvable: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string;
}

interface CaseState {
  currentCase: MasterCase | null;
  gamePhase: 'menu' | 'briefing' | 'investigating' | 'verdict';
  difficulty: 'rookie' | 'detective' | 'inspector' | 'chief' | 'legend';
  cluesFound: string[];           // collected clue IDs
  evidenceAnalyzed: string[];     // analyzed clue IDs
  conversations: Record<string, ChatMessage[]>; // chatMode or suspectId -> chat history
  chatMode: 'partner' | 'npc' | 'forensics' | 'consultant' | 'hint';
  activeNPCId: string;            // character name or id user is interrogating
  playerNotes: string;
  score: number;
  timeLeft: number;               // timer countdown in seconds
  timerActive: boolean;
  hintsUsed: number;
  unlockedHiddenClues: string[];   // clue IDs unlocked via chat
  lawyeredUp: string[];           // suspect names lawyered up
  boardNodes: Node[];
  boardEdges: Edge[];
  detectiveRank: string;
  cloudSaved: boolean;
  accusationsCount: Record<string, number>; // suspect -> confront counts
  
  // Actions
  setGamePhase: (phase: CaseState['gamePhase']) => void;
  setDifficulty: (difficulty: CaseState['difficulty']) => void;
  setChatMode: (mode: CaseState['chatMode']) => void;
  setActiveNPCId: (npcId: string) => void;
  setCurrentCase: (c: MasterCase) => void;
  setCluesFound: (clues: string[]) => void;
  collectClue: (clueId: string) => void;
  analyzeClue: (clueId: string) => void;
  addChatMessage: (modeOrNPC: string, msg: Omit<ChatMessage, 'timestamp'>) => void;
  confrontSuspect: (name: string) => void;
  setPlayerNotes: (notes: string) => void;
  useHint: () => void;
  setBoardNodes: (nodes: Node[]) => void;
  setBoardEdges: (edges: Edge[]) => void;
  updateTimer: (seconds: number) => void;
  setTimerActive: (active: boolean) => void;
  setCloudSaved: (saved: boolean) => void;
  addScore: (points: number) => void;
  resetGame: () => void;
  calculateRank: () => void;
}

export const useCaseStore = create<CaseState>()(
  persist(
    (set, get) => ({
      currentCase: null,
      gamePhase: 'menu',
      difficulty: 'detective',
      cluesFound: [],
      evidenceAnalyzed: [],
      conversations: {},
      chatMode: 'partner',
      activeNPCId: '',
      playerNotes: '',
      score: 0,
      timeLeft: 2700, // 45 mins default
      timerActive: false,
      hintsUsed: 0,
      unlockedHiddenClues: [],
      lawyeredUp: [],
      boardNodes: [],
      boardEdges: [],
      detectiveRank: 'Cadet',
      cloudSaved: false,
      accusationsCount: {},

      setGamePhase: (gamePhase) => set({ gamePhase }),
      setDifficulty: (difficulty) => set({ difficulty }),
      setChatMode: (chatMode) => set({ chatMode }),
      setActiveNPCId: (activeNPCId) => set({ activeNPCId }),
      
      setCurrentCase: (c) => {
        let initialSeconds = 0;
        if (c.difficulty === 'rookie') initialSeconds = 999999; // infinite basically
        else if (c.difficulty === 'detective') initialSeconds = 45 * 60;
        else if (c.difficulty === 'inspector') initialSeconds = 30 * 60;
        else if (c.difficulty === 'chief') initialSeconds = 20 * 60;
        else if (c.difficulty === 'legend') initialSeconds = 15 * 60;

        set({
          currentCase: c,
          gamePhase: 'briefing',
          cluesFound: [...c.initialClues], // Rookie starts with initial clues visible
          evidenceAnalyzed: [],
          conversations: {},
          chatMode: 'partner',
          activeNPCId: c.characters[0]?.name || '',
          playerNotes: '',
          timeLeft: initialSeconds,
          timerActive: c.difficulty !== 'rookie',
          hintsUsed: 0,
          unlockedHiddenClues: [],
          lawyeredUp: [],
          boardNodes: [],
          boardEdges: [],
          cloudSaved: false,
          score: 0,
          accusationsCount: {}
        });
        get().calculateRank();
      },

      setCluesFound: (cluesFound) => set({ cluesFound }),

      collectClue: (clueId) => set((state) => {
        if (state.cluesFound.includes(clueId)) return {};
        const isHidden = state.currentCase?.hiddenClues.includes(clueId);
        const nextClues = [...state.cluesFound, clueId];
        const unlockedHidden = isHidden && !state.unlockedHiddenClues.includes(clueId)
          ? [...state.unlockedHiddenClues, clueId]
          : state.unlockedHiddenClues;

        // +50 points for finding clues through smart investigation
        const scoreGain = isHidden ? 50 : 20;

        return {
          cluesFound: nextClues,
          unlockedHiddenClues: unlockedHidden,
          score: state.score + scoreGain
        };
      }),

      analyzeClue: (clueId) => set((state) => {
        if (state.evidenceAnalyzed.includes(clueId)) return {};
        return {
          evidenceAnalyzed: [...state.evidenceAnalyzed, clueId],
          score: state.score + 25 // +25 for lab diagnostics
        };
      }),

      addChatMessage: (modeOrNPC, msg) => set((state) => {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const history = state.conversations[modeOrNPC] || [];
        const updated = [...history, { ...msg, timestamp }];
        
        return {
          conversations: {
            ...state.conversations,
            [modeOrNPC]: updated
          }
        };
      }),

      confrontSuspect: (name) => set((state) => {
        const count = (state.accusationsCount[name] || 0) + 1;
        const newLawyered = count >= 3 && !state.lawyeredUp.includes(name)
          ? [...state.lawyeredUp, name]
          : state.lawyeredUp;

        return {
          accusationsCount: {
            ...state.accusationsCount,
            [name]: count
          },
          lawyeredUp: newLawyered
        };
      }),

      setPlayerNotes: (playerNotes) => set({ playerNotes }),
      
      useHint: () => set((state) => {
        const penalty = state.difficulty === 'rookie' ? 0 : 50;
        return { 
          hintsUsed: state.hintsUsed + 1,
          score: Math.max(0, state.score - penalty)
        };
      }),
      
      setBoardNodes: (boardNodes) => set({ boardNodes }),
      setBoardEdges: (boardEdges) => set({ boardEdges }),
      
      updateTimer: (seconds) => set((state) => {
        if (state.timeLeft <= 0) {
          return { timeLeft: 0, timerActive: false };
        }
        return { timeLeft: state.timeLeft - seconds };
      }),
      
      setTimerActive: (timerActive) => set({ timerActive }),
      setCloudSaved: (cloudSaved) => set({ cloudSaved }),

      addScore: (points) => set((state) => {
        const updatedScore = Math.max(0, state.score + points);
        return { score: updatedScore };
      }),

      resetGame: () => set({ currentCase: null, gamePhase: 'menu', timerActive: false }),

      calculateRank: () => set((state) => {
        let rank = 'Cadet';
        const s = state.score;
        if (s >= 1500) rank = 'Commissioner';
        else if (s >= 1200) rank = 'Superintendent';
        else if (s >= 900) rank = 'Chief Inspector';
        else if (s >= 600) rank = 'Inspector';
        else if (s >= 350) rank = 'Detective';
        else if (s >= 150) rank = 'Constable';
        return { detectiveRank: rank };
      })
    }),
    {
      name: 'crime-case-investigator-storage',
    }
  )
);
