import type { ChatMessage } from '../../services/curator.ts'

// Replies written in advance for the lounge companion, used until an AI
// Curator is connected. Each mode has its own voice and cycles through its
// replies so a conversation doesn't repeat itself straight away. `{you}` is
// replaced with a short quote from the visitor's last message.

const replies: Record<string, string[]> = {
  open: [
    'That\'s worth sitting with. When you say "{you}", what drew you to it in the first place?',
    'Let me ask it from the other side: what would someone who disagrees with you say, and what would they be right about?',
    'If you came back to this in ten years, which part do you think would still matter to you?',
    'Is this something you\'ve thought about for a long time, or did it arrive recently? Where we meet an idea often shapes how we hold it.',
    'What would change in how you live if you were completely sure about this?',
    'Say a little more. The second explanation of an idea is usually closer to what we really think than the first.',
  ],
  philosophical: [
    'Aristotle would ask what "{you}" is for: what purpose it serves in a good life. How would you answer him?',
    'A Stoic like Epictetus would separate what is up to us from what is not. Which parts of this are actually in your control?',
    'Hume noticed that we often slide from how things are to how they ought to be. Is there an "ought" hiding in what you just said?',
    'Kant would test it by asking: could everyone act this way, all the time, without the idea collapsing? Does it pass?',
    'The existentialists said we are "condemned to be free": no fixed nature tells us what to value. Does that feel freeing or heavy to you here?',
    'Try defining the key word you used. Philosophers often find that the disagreement was hiding inside a definition all along.',
  ],
  perspectives: [
    'A utilitarian would weigh "{you}" by its consequences for everyone affected. A virtue ethicist would ask what it says about the person doing it. Which pull feels stronger to you?',
    'Many Buddhist traditions would look at the attachment behind the question, while a Confucian view would ask how it fits your roles and relationships. What does each show you?',
    'A scientist might ask what evidence would change your mind. A poet might ask what it feels like from inside. Try answering both.',
    'Someone a thousand years ago would almost certainly see this differently. What do you think they would find strange about how we see it now?',
    'Imagine explaining your view to someone from a very different culture or generation. Which part would need the most explaining?',
    'Steelman the view you like least: put it in its strongest, most generous form. Does anything in it survive?',
  ],
  'thought-experiment': [
    'Here\'s one. A machine scans you, destroys the original and builds a perfect copy on Mars, memories and all. Did you travel to Mars, or did you die?',
    'Imagine you\'re behind a "veil of ignorance" (John Rawls): you must design a society without knowing who you\'ll be in it. What rules would you choose?',
    'You find a ring that makes you invisible, like the Ring of Gyges in Plato\'s Republic. No one would ever know what you did. Would you behave any differently?',
    'A runaway trolley will hit five people unless you pull a lever to send it towards one. Most people pull it. Now you must push someone off a bridge to stop it instead. Why does that feel different?',
    'Suppose you could know the exact date of your death. Would you want to? What does your answer say about how you value uncertainty?',
    'Mary has studied everything about colour but has lived her whole life in a black-and-white room. When she first sees red, does she learn something new?',
  ],
  socratic: [
    'When you say "{you}", what exactly do you mean? Could you put it another way?',
    'How do you know that? What first convinced you?',
    'Can you think of a case where it wouldn\'t be true? What makes that case different?',
    'If that\'s right, what else must also be true? Are you happy to accept that as well?',
    'What would someone who disagrees with you say is the weakest part of that?',
    'Has your answer changed at all since we started? What moved, and what stayed fixed?',
  ],
  reflection: [
    'Thank you for sharing that. When you think about "{you}", what feeling comes up first?',
    'What did you hope would happen, and what actually happened? The gap between the two often says a lot.',
    'If a good friend told you this exact story, what would you say to them?',
    'What does this situation ask of you that you find hardest to give?',
    'Looking back, is there a moment where a different choice was available? What made the one you took feel right at the time?',
    'What would you like to remember about this a year from now?',
  ],
}

/** Short quote of the visitor's message for `{you}`. */
function quote(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '')
  if (clean.length <= 60) return clean
  return `${clean.slice(0, 57).replace(/\s+\S*$/, '')}…`
}

export function placeholderReply(modeId: string, messages: ChatMessage[]): string {
  const list = replies[modeId] ?? replies.open
  const turn = messages.filter((m) => m.role === 'assistant').length
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  return list[turn % list.length].replace('{you}', quote(lastUser))
}

export const placeholderModes = Object.keys(replies)
