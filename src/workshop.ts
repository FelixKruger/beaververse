import './workshop.css';

type WorkshopActions = {
  openChatDraft: (text: string) => void;
  openTakeawayDraft: (text: string) => void;
};
type Position = { x: number; y: number; z: number };

const prompts = [
  {
    title: 'Share your project',
    detail: 'What are you making, who is it for, and where could someone help?',
    chat: "I'm building … for … . I'd love a second pair of eyes on … .",
    takeaway: 'What I am building: …\nA useful next step: …',
  },
  {
    title: 'Ask for a little help',
    detail: 'Bring one obstacle and the kind of help that would move you forward.',
    chat: "I'm trying to … and getting stuck on … . Has anyone tried a useful approach?",
    takeaway: 'Question I explored: …\nAn idea to try next: …',
  },
  {
    title: 'Pass on a useful tool',
    detail: 'Share a concrete use, a limitation, and a link if you have one.',
    chat: 'One tool or technique I found useful is … . It helps with … . One limitation is … .',
    takeaway: 'Tool or technique: …\nWhere I could use it: …\nLimit or caution: …',
  },
];

/** Optional local prompts. The callbacks open drafts; this module never sends or saves. */
export function createWorkshop(actions: WorkshopActions) {
  let selected = 0;
  const trigger = document.createElement('button');
  trigger.id = 'workshop-button'; trigger.className = 'workshop-prompt-button';
  trigger.textContent = 'Workshop · try a builder prompt'; trigger.hidden = true;
  trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-controls', 'workshop-dialog');

  const dialog = document.createElement('dialog');
  dialog.id = 'workshop-dialog'; dialog.setAttribute('aria-labelledby', 'workshop-title');
  const heading = document.createElement('div'); heading.className = 'panel-title';
  const title = document.createElement('strong'); title.id = 'workshop-title'; title.textContent = 'Make something of this visit';
  const close = document.createElement('button'); close.id = 'close-workshop'; close.className = 'quiet';
  close.textContent = '×'; close.setAttribute('aria-label', 'Back to the clearing');
  heading.append(title, close);
  const intro = document.createElement('p');
  intro.textContent = 'A place to trade ideas or think something through on your own. Choose a starting point.';
  const choices = document.createElement('div'); choices.className = 'workshop-choices'; choices.setAttribute('aria-label', 'Builder prompts');
  const buttons = prompts.map((prompt, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.workshopPrompt = String(index);
    button.setAttribute('aria-pressed', String(index === selected));
    const name = document.createElement('strong'); name.textContent = prompt.title;
    const detail = document.createElement('span'); detail.textContent = prompt.detail;
    button.append(name, detail);
    button.onclick = () => { selected = index; buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === selected))); };
    choices.append(button); return button;
  });
  const actionRow = document.createElement('div'); actionRow.className = 'workshop-actions';
  const chat = document.createElement('button'); chat.id = 'workshop-chat'; chat.textContent = 'Draft in chat';
  const takeaway = document.createElement('button'); takeaway.id = 'workshop-takeaway'; takeaway.textContent = 'Keep a takeaway';
  actionRow.append(chat, takeaway);
  const note = document.createElement('p'); note.className = 'workshop-note';
  note.textContent = 'Both actions open an editable draft. Nothing is sent or saved until you choose to do so.';
  dialog.append(heading, intro, choices, actionRow, note);
  document.body.append(trigger, dialog);

  const open = () => { if (!document.querySelector('dialog[open]')) dialog.showModal(); };
  trigger.onclick = open;
  close.onclick = () => dialog.close();
  dialog.addEventListener('close', () => document.getElementById('world')?.focus());
  // The native close event is asynchronous: focus the destination after it fires.
  const handoff = (action: (text: string) => void, text: string) => {
    dialog.addEventListener('close', () => action(text), { once: true });
    dialog.close();
  };
  chat.onclick = () => handoff(actions.openChatDraft, prompts[selected].chat);
  takeaway.onclick = () => handoff(actions.openTakeawayDraft, prompts[selected].takeaway);

  return {
    open,
    update(position: Position) {
      const nearby = [{ x: -4.7, y: 0, z: -4 }, { x: 11.4, y: 3.2, z: -1.5 }].some(
        bench => Math.abs(position.y - bench.y) < .8 && Math.hypot(position.x - bench.x, position.z - bench.z) < 2.8,
      );
      trigger.hidden = !nearby || !!document.querySelector('dialog[open]');
    },
  };
}
