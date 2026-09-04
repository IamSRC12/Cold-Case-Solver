export interface Suspect {
  id: string;
  name: string;
  age: number;
  relationship: string;
  personality: string;
  backstory: string;
  alibi: string;
  secret: string;
  is_guilty: boolean;
  speaking_style: string;
  occupation: string;
  motive: string;
}

export interface Evidence {
  id: string;
  name: string;
  location: string;
  description: string;
  is_key_evidence: boolean;
  connects_to?: string;
  analysis_result?: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  evidence_ids: string[];
}

export interface GeneratedCase {
  title: string;
  tagline: string;
  difficulty: string;
  setting: { location: string; time: string; atmosphere: string };
  victim: { name: string; age: number; occupation: string; cause_of_death: string; secrets: string[] };
  suspects: Suspect[];
  evidence: Evidence[];
  solution: { culprit_id: string; method: string; motive: string; opportunity: string; explanation: string };
  red_herrings: string[];
  crime_scene_rooms: Room[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Accusation record — player's final accusation choice
export interface Accusation {
  suspectId: string;
  theory: string;
  correct: boolean;
}
