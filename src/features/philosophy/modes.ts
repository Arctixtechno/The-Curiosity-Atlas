/** Conversation modes from spec section 5.2. */
export interface ConversationMode {
  id: string
  name: string
  description: string
  /** Suggested openings shown before the first message. */
  starters: string[]
}

export const conversationModes: ConversationMode[] = [
  {
    id: 'open',
    name: 'Open conversation',
    description: 'Talk about whatever is on your mind.',
    starters: ["Something I read today has stuck with me…", "What's a question you think people don't ask enough?"],
  },
  {
    id: 'philosophical',
    name: 'Philosophical discussion',
    description: 'Morality, happiness, identity, meaning, freedom and human nature.',
    starters: ['Is it possible to be happy without meaning?', 'Do we really have free will?'],
  },
  {
    id: 'perspectives',
    name: 'Different perspectives',
    description: 'See a subject through contrasting philosophical, cultural or intellectual viewpoints.',
    starters: ['How would different traditions think about ambition?', 'Show me opposing views on whether lying is ever right.'],
  },
  {
    id: 'thought-experiment',
    name: 'Thought experiments',
    description: 'Hypothetical scenarios that challenge your assumptions.',
    starters: ['Give me a thought experiment about personal identity.', 'Test my intuitions about fairness.'],
  },
  {
    id: 'socratic',
    name: 'Socratic dialogue',
    description: 'Careful questions that help you examine your own reasoning.',
    starters: ['I believe people are basically good.', 'I think success is mostly luck.'],
  },
  {
    id: 'reflection',
    name: 'Personal reflection',
    description: 'Reflect on experiences, decisions and ways of thinking. Kept private.',
    starters: ["I'm weighing a decision and can't settle it.", 'I want to understand why something bothered me.'],
  },
]
