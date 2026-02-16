import { eventBus, Events } from '../core/EventBus';
import { DOS_COLOR_NAMES } from '../core/DosColors';

const MAX_LINES = 7;
const RECENT_RANDOM_WINDOW = 10;
const IDLE_DELAY_MS = 20000;
const IDLE_INTERVAL_MS = 28000;
const TYPE_CHAR_MS = 18;
const TYPE_LINE_PAUSE_MS = 120;

type LineKind = 'system' | 'quote';

interface TerminalEntry {
  text: string;
  kind: LineKind;
}

const TOOL_MESSAGES: Record<string, string[]> = {
  pencil: [
    'Pencil armed. Sketch it like you mean it.',
    'Freehand mode ready. Make it iconic.',
    'Pencil online. Every pixel is a decision.',
    'Sketch mode engaged. Make it legendary.',
  ],
  line: [
    'Line tool selected. Straight to the point.',
    'Precision line online. Nice and clean.',
    'Line mode active. Keep it razor-straight.',
    'Vector vibes detected. Draw with intent.',
  ],
  rectangle: [
    'Rectangle tool selected. Build the frame.',
    'Corners locked in. Draw that box.',
    'Rectangle mode online. Structure incoming.',
    'Frame protocol loaded. Crisp edges ahead.',
  ],
  'filled-rectangle': [
    'Filled rectangle ready. Big bold blocks.',
    'Solid fill mode selected. Lay it down.',
    'Block mode activated. Commit to the mass.',
    'Filled rectangle armed. Chunky pixels win.',
  ],
  circle: [
    'Circle tool ready. Round and proud.',
    'Arc reactor engaged. Draw that curve.',
    'Orbital mode selected. Smooth loops only.',
    'Circle protocol active. Bend the grid gently.',
  ],
  'filled-circle': [
    'Filled circle active. Full orbit.',
    'Solid circle mode ready. Nice choice.',
    'Filled orbit loaded. Heavy round energy.',
    'Disc mode online. Saturate that arc.',
  ],
  fill: [
    'Fill tool selected. Flood it with confidence.',
    'Bucket primed. One click, big impact.',
    'Area fill armed. Let color flow.',
    'Flood engine hot. Coverage incoming.',
  ],
  dropper: [
    'Dropper active. Sample with style.',
    'Color sampler ready. Capture that tone.',
    'Dropper online. Hunt the perfect shade.',
    'Sampling mode active. Palette precision engaged.',
  ],
  text: [
    'Text tool selected. Words have entered the chat.',
    'Type mode active. Make it say something.',
    'Text channel open. Message incoming.',
    'Glyph writer ready. Compose boldly.',
  ],
  eraser: [
    'Eraser selected. Clean edits win.',
    'Erase mode active. No fear, just refine.',
    'Cleanup tool online. Precision deletions only.',
    'Eraser engaged. Shape by subtraction.',
  ],
  selection: [
    'Selection tool ready. Move with intent.',
    'Selection online. Precision repositioning.',
    'Selection mode active. Box, move, perfect.',
    'Region control loaded. Rearrange like a pro.',
  ],
  smartline: [
    'Smart line selected. Grid logic engaged.',
    'Smart line active. Clean junctions ahead.',
    'Smart routing online. Connections stay tidy.',
    'Topology mode active. Corners will behave.',
  ],
  smartbox: [
    'Smart box selected. Structured chaos incoming.',
    'Smart box mode active. Snap those edges.',
    'Smart box engaged. Junction logic is watching.',
    'Auto-box protocol loaded. Symmetry incoming.',
  ],
};

const DRAW_MESSAGES = [
  'Nice stroke. Keep building.',
  'Clean move. Looking sharp.',
  'That lands well. Keep going.',
  'Solid pass. Momentum is good.',
  'Strong mark. Nice control.',
  'Good commit. Keep the rhythm.',
  'That action reads clean. Continue.',
  'Excellent placement. Maintain vector energy.',
  'Dialed in. You are in flow state.',
  'That pixel work is crisp.',
];

const DRAW_MESSAGES_BY_TOOL: Record<string, string[]> = {
  pencil: [
    'Freehand pass complete. That has personality.',
    'Pencil stroke logged. Bold choice.',
    'Sketch committed. Handcrafted confidence.',
    'Organic line captured. Nice motion.',
  ],
  line: [
    'Line committed. Geometry approves.',
    'Straight shot. Zero wobble detected.',
    'Beam locked. Endpoint achieved.',
    'Path plotted. Alignment looks perfect.',
  ],
  rectangle: [
    'Frame deployed. Crisp corners.',
    'Box drawn. Very architect-core.',
    'Rectangle placed. Clean perimeter.',
    'Boundary confirmed. Excellent framing.',
  ],
  'filled-rectangle': [
    'Solid block placed. Chunky and good.',
    'Filled rectangle dropped. Strong silhouette.',
    'Mass committed. Bold fill reads well.',
    'Solid region stamped. Nice weight.',
  ],
  circle: [
    "That's no moon. It's a clean circle.",
    'Circle complete. The force is in your wrist.',
    'That circle is fully operational.',
    'Targeting computer says this arc is true.',
    'Orbital geometry confirmed. Rebel applause.',
  ],
  'filled-circle': [
    "That's no moon. It's fully loaded.",
    'Filled orbit achieved. Rebel-approved curve.',
    'One ping only... and the fill is perfect.',
    'Round payload deployed. Impact: delightful.',
    'Death Star energy, but make it wholesome.',
  ],
  smartline: [
    'Smart line landed. Grid gods are pleased.',
    'Auto-junction snapped in. Very tidy.',
    'Connection solved. Right angles rejoice.',
    'Smart path complete. Network integrity: high.',
  ],
  smartbox: [
    'Smart box formed. Structure level: elite.',
    'Auto-box committed. Connections look sharp.',
    'Smart frame placed. Junctions all green.',
    'Box logic succeeded. Crisp lattice energy.',
  ],
  fill: [
    'Flood complete. Area secured.',
    'Bucket action successful. Coverage: excellent.',
    'Field saturated. Color spread optimal.',
    'Fill operation complete. Zero dry spots.',
  ],
  text: [
    'Text placed. Narrative unlocked.',
    'Words committed. Nice typography energy.',
    'Copy deployed. Message received.',
    'Glyph sequence saved. Looks clean.',
  ],
  eraser: [
    'Cleanup pass complete. Surgical.',
    'Erased with precision. Respect.',
    'Noise removed. Signal improved.',
    'Subtractive edit complete. Much cleaner.',
  ],
  selection: [
    'Selection move confirmed. Good positioning.',
    'Region action complete. Nicely aligned.',
    'Selection applied. Placement upgraded.',
    'Region operation successful. Nice composition.',
  ],
  dropper: [
    'Sample taken. Palette intelligence increased.',
    'Color acquired. Carry on.',
    'Pigment captured. Swatch quality: premium.',
    'Reference color locked. Proceed.',
  ],
};

const IDLE_QUOTES = [
  "I'm your huckleberry.",
  'Bring out your dead... but not this canvas.',
  'Chuck Norris counted to infinity. Twice.',
  'Chuck Norris can divide by zero.',
  'Chuck Norris can hear sign language.',
  'Chuck Norris beat the sun in a staring contest.',
  'Chuck Norris can slam a revolving door.',
  'I see dead pixels.',
  'May the force be with your line spacing.',
  'Jabba, this is your last warning.',
  'These are not the pixels you are looking for.',
  'Never tell me the odds. Just align the grid.',
  'I find your lack of anti-aliasing disturbing.',
  "I'm going to need you to come in on Saturday, the usual time.",
  'PC load letter? What the hell does that mean?',
  'The cake is a lie, but the cursor is real.',
  'War. War never changes. But this canvas can.',
  'Would you kindly place one more pixel?',
  'Live long and rasterize.',
  'C64 fact: CPU was the MOS 6510, running at about 1 MHz.',
  'C64 fact: the SID chip (6581/8580) gave it that legendary sound.',
  'C64 fact: VIC-II handled sprites, scrolling, and raster tricks.',
  'C64 fact: roughly 12.5 to 17 million units sold worldwide.',
  'C64 trick: POKE 53280,0 sets border color to black.',
  'C64 trick: POKE 53281,6 gives a classic blue background.',
  'C64 trick: SYS 64738 performs a soft reset.',
  'C64 trick: LOAD "*",8,1 then RUN to boot from disk.',
  'C64 tip: 64 KB RAM felt huge in 1982.',
  'C64 tip: SID had 3 voices plus analog filter magic.',
  'TRON says: END OF LINE.',
  'I fight for the users.',
  'Greetings, programs.',
  'The Grid is alive tonight.',
  'No quarters needed in this light cycle arena.',
  'Legacy protocol: never miss your line.',
  'Roads? Where we\'re going, we don\'t need roads.',
  'There is no spoon. There is only monospace.',
  'Keep calm and draw one cell at a time.',
  'Inconceivable... and yet, perfectly aligned.',
  'Do. Or do not. There is no almost-grid.',
  'Adventure? Excitement? A Jedi craves clean pixels.',
  'You had me at monospace.',
  'As you wish... now place that next pixel.',
  'Wax on, wax off, then perfect your shading.',
  'The Dude abides. So does this cursor.',
  'Nobody puts this canvas in a corner.',
  'Fortune favors the bold stroke.',
  'Stay awhile, and listen... then draw.',
  'Great Scott! That alignment is heavy.',
  'To pixelate, or not to pixelate.',
  'If you prepend the word THE to something, it makes it epic!',
];

const STARTUP_MESSAGES = [
  '38911 BASIC BYTES FREE. READY.',
  'LOAD "*",8,1 ... READY.',
  'CRT phosphor warmed. Terminal online.',
  'Boot sequence complete. Pixels standing by.',
  'Vector sync locked. Awaiting your command.',
  'INSERT ARTIST, PRESS START.',
  'MEMORY CHECK OK. BRING THE PIXELS.',
  'BEEP... BOOP... RASTER GRID READY.',
  'SYSTEM READY. MONOSPACE DREAMS ENABLED.',
  'WELCOME OPERATOR. INPUT ACCEPTED.',
];

function formatToolName(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export class TerminalPanel {
  private element: HTMLElement;
  private contentEl: HTMLElement;
  private lines: TerminalEntry[] = [];
  private queue: TerminalEntry[] = [];
  private recentRandomMessages: string[] = [];
  private activeTool = 'pencil';
  private typing = false;
  private typingEntry: TerminalEntry | null = null;
  private typingIndex = 0;
  private typingTimer: number | null = null;
  private lastDrawAt = 0;
  private idleTimeout: number | null = null;
  private idleInterval: number | null = null;
  private isSuspended = false;

  constructor(private container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'terminal-panel';

    const header = document.createElement('div');
    header.className = 'terminal-panel-header';
    const headerTitle = document.createElement('span');
    headerTitle.textContent = 'CONSOLE';
    const helpBtn = document.createElement('button');
    helpBtn.className = 'terminal-help-btn';
    helpBtn.type = 'button';
    helpBtn.textContent = '?';
    helpBtn.title = 'About Asciimator';
    helpBtn.addEventListener('click', () => {
      this.pushLine('Asciimator is provided to you by <i>The</> Carl Edwards.');
      this.pushLine('Show him some <3 on his GitHub: https://github.com/carledwards/Asciimator');
      this.resetIdleTimers();
    });
    header.appendChild(headerTitle);
    header.appendChild(helpBtn);

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'terminal-panel-content';

    this.element.appendChild(header);
    this.element.appendChild(this.contentEl);
    this.container.appendChild(this.element);

    const visible = localStorage.getItem('asciimator-console-visible') === 'true';
    if (!visible) {
      this.element.style.display = 'none';
      this.isSuspended = true;
    }

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    eventBus.on(Events.CONSOLE_TOGGLED, (show: unknown) => this.onConsoleToggled(show as boolean));
    this.wireEvents();

    if (visible) {
      this.pushLine(this.pickFromPool(STARTUP_MESSAGES));
      this.resetIdleTimers();
    }
  }

  private onConsoleToggled(show: boolean): void {
    if (show) {
      this.element.style.display = '';
      this.isSuspended = false;
      this.pushLine(this.pickFromPool(STARTUP_MESSAGES));
      this.resetIdleTimers();
      this.kickTypewriter();
    } else {
      this.element.style.display = 'none';
      // Suspend: clear queue, typing state, and idle timers
      this.queue = [];
      this.typing = false;
      this.typingEntry = null;
      this.typingIndex = 0;
      if (this.typingTimer) {
        window.clearTimeout(this.typingTimer);
        this.typingTimer = null;
      }
      if (this.idleTimeout) {
        window.clearTimeout(this.idleTimeout);
        this.idleTimeout = null;
      }
      if (this.idleInterval) {
        window.clearInterval(this.idleInterval);
        this.idleInterval = null;
      }
      this.isSuspended = true;
    }
  }

  private onVisibilityChange = (): void => {
    this.isSuspended = document.hidden;
    if (this.isSuspended) {
      // Drop any pending chatter while hidden; keep current lines as-is.
      this.queue = [];
      this.typing = false;
      this.typingEntry = null;
      this.typingIndex = 0;
      if (this.typingTimer) {
        window.clearTimeout(this.typingTimer);
        this.typingTimer = null;
      }
      if (this.idleTimeout) {
        window.clearTimeout(this.idleTimeout);
        this.idleTimeout = null;
      }
      if (this.idleInterval) {
        window.clearInterval(this.idleInterval);
        this.idleInterval = null;
      }
      this.render();
      return;
    }
    // Resume normal behavior without replaying anything that happened while hidden.
    this.resetIdleTimers();
    this.kickTypewriter();
  };

  private wireEvents(): void {
    eventBus.on(Events.TOOL_CHANGED, (tool: unknown) => {
      const key = (tool as string) || 'tool';
      this.activeTool = key;
      const list = TOOL_MESSAGES[key];
      if (list && list.length > 0) {
        this.pushLine(this.pickFromPool(list));
      } else {
        this.pushLine(`${formatToolName(key)} tool selected.`);
      }
      this.resetIdleTimers();
    });

    eventBus.on(Events.CHAR_CHANGED, (ch: unknown) => {
      const char = (ch as string) ?? ' ';
      this.pushLine(char === ' ' ? 'Character set to Space (erase).' : `Character set to '${char}'.`);
      this.resetIdleTimers();
    });

    eventBus.on(Events.COLOR_CHANGED, (data: unknown) => {
      const d = data as { foreground?: number; background?: number };
      if (d.foreground !== undefined) {
        this.pushLine(`FG -> ${DOS_COLOR_NAMES[d.foreground] ?? `#${d.foreground}`}.`);
      }
      if (d.background !== undefined) {
        this.pushLine(`BG -> ${DOS_COLOR_NAMES[d.background] ?? `#${d.background}`}.`);
      }
      this.resetIdleTimers();
    });

    eventBus.on(Events.MOUSE_UP, () => {
      const now = Date.now();
      if (now - this.lastDrawAt < 350) return;
      this.lastDrawAt = now;
      const list = DRAW_MESSAGES_BY_TOOL[this.activeTool] ?? DRAW_MESSAGES;
      this.pushLine(this.pickFromPool(list));
      this.resetIdleTimers();
    });

    eventBus.on(Events.UNDO, () => {
      this.pushLine('Undo executed. Good refinement.');
      this.resetIdleTimers();
    });

    eventBus.on(Events.REDO, () => {
      this.pushLine('Redo executed. Forward momentum.');
      this.resetIdleTimers();
    });

    eventBus.on(Events.DOCUMENT_RESIZED, (data: unknown) => {
      const d = data as { width: number; height: number };
      this.pushLine(`Canvas resized to ${d.width}x${d.height}.`);
      this.resetIdleTimers();
    });
  }

  private pushLine(message: string, kind: LineKind = 'system'): void {
    if (this.isSuspended) return;
    const prefixed = `> ${message}`;
    const lastRendered = this.lines[this.lines.length - 1]?.text;
    const lastQueued = this.queue[this.queue.length - 1]?.text;
    const typingText = this.typingEntry?.text;
    if (prefixed === lastRendered || prefixed === lastQueued || prefixed === typingText) {
      return;
    }
    this.queue.push({ text: prefixed, kind });
    this.kickTypewriter();
  }

  private pickFromPool(items: string[]): string {
    if (items.length === 0) return '';
    const candidates = items.filter((item) => !this.recentRandomMessages.includes(item));
    const pickBase = candidates.length > 0 ? candidates : items;
    const chosen = pickBase[Math.floor(Math.random() * pickBase.length)];
    this.recentRandomMessages.push(chosen);
    if (this.recentRandomMessages.length > RECENT_RANDOM_WINDOW) {
      this.recentRandomMessages.splice(0, this.recentRandomMessages.length - RECENT_RANDOM_WINDOW);
    }
    return chosen;
  }

  private kickTypewriter(): void {
    if (this.isSuspended) {
      this.render();
      return;
    }
    if (this.typing || this.queue.length === 0) {
      this.render();
      return;
    }
    this.typing = true;
    this.typingEntry = this.queue.shift() || null;
    this.typingIndex = 0;
    this.render();
    this.scheduleNextChar();
  }

  private scheduleNextChar(delay: number = TYPE_CHAR_MS): void {
    if (this.isSuspended) return;
    if (this.typingTimer) {
      window.clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
    this.typingTimer = window.setTimeout(() => this.stepTypewriter(), delay);
  }

  private stepTypewriter(): void {
    if (this.isSuspended) return;
    if (!this.typing || !this.typingEntry) return;

    if (this.typingIndex < this.typingEntry.text.length) {
      this.typingIndex += 1;
      this.render();
      this.scheduleNextChar(TYPE_CHAR_MS);
      return;
    }

    this.lines.push(this.typingEntry);
    if (this.lines.length > MAX_LINES) {
      this.lines.splice(0, this.lines.length - MAX_LINES);
    }
    this.typing = false;
    this.typingEntry = null;
    this.typingIndex = 0;
    this.render();

    if (this.typingTimer) {
      window.clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
    this.typingTimer = window.setTimeout(() => {
      this.typingTimer = null;
      this.kickTypewriter();
    }, TYPE_LINE_PAUSE_MS);
  }

  private render(): void {
    this.contentEl.innerHTML = '';

    const rendered: TerminalEntry[] = [...this.lines];
    if (this.typing && this.typingEntry) {
      rendered.push({
        text: this.typingEntry.text.slice(0, this.typingIndex),
        kind: this.typingEntry.kind,
      });
    } else if (rendered.length === 0) {
      rendered.push({ text: '', kind: 'system' });
    }

    for (const entry of rendered) {
      const line = document.createElement('div');
      line.className = `terminal-line ${entry.kind === 'quote' ? 'terminal-line-quote' : ''}`;
      this.renderLineContent(line, entry.text);
      this.contentEl.appendChild(line);
    }

    const cursorLine = document.createElement('div');
    cursorLine.className = 'terminal-line terminal-cursor-line';
    cursorLine.textContent = '█';
    this.contentEl.appendChild(cursorLine);
  }

  private renderLineContent(line: HTMLElement, text: string): void {
    const italicText = text.replace(/<i>/g, '\uFFF0').replace(/<\/>|<\/i>/g, '\uFFF1');
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = urlRegex.exec(italicText)) !== null) {
      const index = match.index;
      const url = match[0];
      if (index > lastIndex) {
        this.appendStyledText(line, italicText.slice(lastIndex, index));
      }
      const anchor = document.createElement('a');
      anchor.className = 'terminal-link';
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = url;
      line.appendChild(anchor);
      lastIndex = index + url.length;
    }

    if (lastIndex < italicText.length) {
      this.appendStyledText(line, italicText.slice(lastIndex));
    }
  }

  private appendStyledText(parent: HTMLElement, text: string): void {
    let cursor = 0;
    let inItalic = false;
    let buffer = '';

    const flush = () => {
      if (!buffer) return;
      if (inItalic) {
        const em = document.createElement('em');
        em.textContent = buffer;
        parent.appendChild(em);
      } else {
        parent.appendChild(document.createTextNode(buffer));
      }
      buffer = '';
    };

    while (cursor < text.length) {
      const ch = text[cursor];
      if (ch === '\uFFF0' || ch === '\uFFF1') {
        flush();
        inItalic = ch === '\uFFF0';
        cursor += 1;
        continue;
      }
      buffer += ch;
      cursor += 1;
    }
    flush();
  }

  private resetIdleTimers(): void {
    if (this.isSuspended) return;
    if (this.idleTimeout) {
      window.clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
    if (this.idleInterval) {
      window.clearInterval(this.idleInterval);
      this.idleInterval = null;
    }

    this.idleTimeout = window.setTimeout(() => {
      this.pushLine(this.pickFromPool(IDLE_QUOTES), 'quote');
      this.idleInterval = window.setInterval(() => {
        this.pushLine(this.pickFromPool(IDLE_QUOTES), 'quote');
      }, IDLE_INTERVAL_MS);
    }, IDLE_DELAY_MS);
  }
}
