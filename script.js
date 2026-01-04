// ---------- Utilities ----------
const $ = (s) => document.querySelector(s);
const editor = $('#editor');
const goalInput = $('#goal');
const goalDisplay = $('#goalDisplay');
const wordsEl = $('#words');
const remainingEl = $('#remaining');
const bar = $('#bar');
const ring = $('#ringProgress');
const ringLabel = $('#ringLabel');
const celebrate = $('#celebrate');
const themeToggle = $('#themeToggle');

const STORAGE_KEYS = {
  text: 'wt:text',
  goal: 'wt:goal',
  theme: 'wt:theme',
  stats: 'wt:stats',
};

// ------------------------------------------------------------------
// START: ASYNCHRONOUS STORAGE HELPER (IndexedDB via Dexie)
// ------------------------------------------------------------------

// 1. Define the Database Structure
const db = new Dexie('MinWriteDB'); // Renamed to fit your app

// 2. Define the Object Store
// 'content' is the storage area. 'key' is the primary key.
db.version(1).stores({
  content: 'key', // This defines a store where we can save items by a unique 'key'
});

// A standard helper function to wrap the DB operations
const storage = {
  /**
   * Get a value from IndexedDB (Asynchronous)
   * @param {string} key - Storage key
   * @param {*} defaultValue - Value to return if key doesn't exist
   * @returns {Promise<*>} The parsed value or default
   */

  async get(key, defaultValue = null) {
    try {
      // Look up the item in the 'content' store by its key
      const item = await db.content.get(key);

      // If the item exists, return its 'value'. Otherwise, return the defaultValue.
      return item ? item.value : defaultValue;
    } catch (err) {
      // IndexedDB failed or is blocked. Log the error and return default.
      console.error(
        `CRITICAL: Failed to get ${key} from IndexedDB. Returning default.`,
        err
      );
      return defaultValue;
    }
  },

  /**
   * Save a value to IndexedDB (Asynchronous)
   * @param {string} key - Storage key
   * @param {*} value - Value to store (can be any object)
   * @returns {Promise<boolean>} True if successful
   */
  async set(key, value) {
    try {
      // Use .put() to either insert a new item or replace an existing one
      await db.content.put({ key: key, value: value });
      return true;
    } catch (err) {
      console.error(`Failed to set ${key} in storage:`, err);
      // Dexie/IndexedDB usually doesn't hit QuotaExceededError until very high limits,
      // but we keep the error reporting for safety.
      return false;
    }
  },

  /**
   * Remove an item from IndexedDB (Asynchronous)
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async remove(key) {
    try {
      await db.content.delete(key);
    } catch (err) {
      console.warn(`Failed to remove ${key} from storage:`, err);
    }
  },
};

// ------------------------------------------------------------------
// END: ASYNCHRONOUS STORAGE HELPER
// ------------------------------------------------------------------

// ----------------------------------------------------------------------
// CELEBRATION MESSAGES
// ----------------------------------------------------------------------
const CELEBRATION_MESSAGES = [
  'Goal achieved! Nice work.',
  "Way to crush it! You're unstoppable.",
  'Word count met! Time to take a bow.',
];

// ----------------------------------------------------------------------
// APP TAGLINES (rotates on page load)
// ----------------------------------------------------------------------
const APP_TAGLINES = [
  'Just keep writing.',
  'Words before worries.',
  'One word at a time.',
  'Your story starts here.',
  'Write now, edit later.',
  'Progress over perfection.',
];

// ----------------------------------------------------------------------
// CONFETTI COLOR PALETTES
// ----------------------------------------------------------------------
const CONFETTI_PALETTES = {
  light: {
    // Jade, mint, soft blue — 80% of confetti
    cool: [
      '#2e7d6d', // jade
      '#3b9a7d', // jade light
      '#53d3a7', // mint
      '#6ce1b8', // mint light
      '#4fc3f7', // soft blue
      '#29b6f6', // soft blue vivid
      '#a2d9ca', // accent soft
    ],
    // Gold/amber to echo celebration banner — 20% of confetti
    warm: [
      '#ffc700', // gold
      '#ffdb4d', // gold light
    ],
  },
  dark: {
    // Brighter, more luminous versions for dark backgrounds
    cool: [
      '#3b9a7d', // jade (brighter)
      '#4cb896', // jade vivid
      '#6ce1b8', // mint (brighter)
      '#8df0cc', // mint vivid
      '#4fc3f7', // soft blue
      '#67d4ff', // soft blue vivid
      '#7eeaca', // accent luminous
    ],
    warm: [
      '#ffc700', // gold
      '#ffe14d', // gold bright
    ],
  },
};

// ------------------------------------------------------------------
// ERROR HANDLER
// ------------------------------------------------------------------

const createErrorHandler = () => {
  // Error severity levels
  const LEVEL = {
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    CRITICAL: 'critical',
  };

  /**
   * Central error handling function
   * @param {Error|string} err - The error object or message
   * @param {string} context - Where the error occurred (e.g., 'save', 'export')
   * @param {Object} options - Additional options
   * @param {string} options.level - Severity level (info/warn/error/critical)
   * @param {boolean} options.notify - Show a toast to the user
   * @param {boolean} options.silent - Suppress console output
   */
  const handle = (err, context, options = {}) => {
    const { level = LEVEL.ERROR, notify = false, silent = false } = options;

    const message = err instanceof Error ? err.message : String(err);
    const timestamp = new Date().toISOString();

    // Console output (unless silent)
    if (!silent) {
      const logPrefix = `[${timestamp}] [${context}]`;

      switch (level) {
        case LEVEL.INFO:
          console.info(logPrefix, message);
          break;
        case LEVEL.WARN:
          console.warn(logPrefix, message);
          break;
        case LEVEL.CRITICAL:
          console.error(logPrefix, '🚨 CRITICAL:', message);
          if (err instanceof Error) console.error(err.stack);
          break;
        default:
          console.error(logPrefix, message);
      }
    }

    // User notification (if requested)
    if (notify) {
      showErrorToast(context, level);
    }

    // Return false to indicate error state (useful for chaining)
    return false;
  };

  // Simple toast for errors (reuses existing toast pattern)
  const showErrorToast = (context, level) => {
    const toast = document.getElementById('saveToast');
    if (!toast) return;

    const messages = {
      info: `Note: ${context}`,
      warn: `Warning: ${context}`,
      error: `Error: ${context}`,
      critical: `Failed: ${context}`,
    };

    const originalText = toast.textContent;
    toast.textContent = messages[level] || `Error: ${context}`;
    toast.classList.add('show');

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.remove('show');
      toast.textContent = originalText;
    }, 2500);
  };

  return {
    LEVEL,
    handle,

    // Convenience methods
    info: (err, context, options = {}) =>
      handle(err, context, { ...options, level: LEVEL.INFO }),

    warn: (err, context, options = {}) =>
      handle(err, context, { ...options, level: LEVEL.WARN }),

    error: (err, context, options = {}) =>
      handle(err, context, { ...options, level: LEVEL.ERROR }),

    critical: (err, context, options = {}) =>
      handle(err, context, { ...options, level: LEVEL.CRITICAL }),
  };
};

// Create the singleton instance
const errorHandler = createErrorHandler();

// ------------------------------------------------------------------
// DEBOUNCE UTILITY
// ------------------------------------------------------------------

/**
 * Creates a debounced version of a function that delays execution
 * until after the specified wait time has elapsed since the last call.
 * @param {Function} fn - The function to debounce
 * @param {number} ms - The delay in milliseconds
 * @returns {Function} The debounced function
 */
const debounce = (fn, ms) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
};

// ------------------------------------------------------------------
// SPRINT MANAGER
// ------------------------------------------------------------------

const createSprintManager = () => {
  // Private state - nothing outside can directly modify this
  let state = {
    tock: null,
    status: 'idle', // 'idle' | 'running' | 'paused' | 'finished'
    durationMs: 0,
    startTime: 0,
    startWords: 0,
    wordsGained: 0,
  };

  // Private helper to update the clock display
  const updateClockDisplay = (ms) => {
    const mm = String(Math.floor(ms / 60_000)).padStart(2, '0');
    const ss = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');

    // Update unified sprint pill
    if (els.sprintDisplay) {
      els.sprintDisplay.textContent = `${mm}:${ss}`;
    }

    // Update focus mode sprint display
    if (els.focusSprint) {
      els.focusSprint.textContent = ms > 0 ? `Sprint: ${mm}:${ss}` : '';
    }
    return { mm, ss };
  };

  // Private helper to update pill classes
  const updatePillClasses = (add = [], remove = []) => {
    const pill = els.sprintPill;
    if (!pill) return;
    remove.forEach((cls) => pill.classList.remove(cls));
    add.forEach((cls) => pill.classList.add(cls));
  };

  // Private helper to update pill display text
  const setPillDisplay = (text) => {
    if (els.sprintDisplay) {
      els.sprintDisplay.textContent = text;
    }
  };

  // Private helper to update pill aria-label
  const setPillAriaLabel = (label) => {
    if (els.sprintPill) {
      els.sprintPill.setAttribute('aria-label', label);
    }
  };

  return {
    // Read-only access to current state
    getState: () => ({ ...state }),

    // Status checks
    isIdle: () => state.status === 'idle',
    isRunning: () => state.status === 'running',
    isPaused: () => state.status === 'paused',
    isFinished: () => state.status === 'finished',
    isActive: () => state.status === 'running' || state.status === 'paused',

    start: (minutes, currentWordCount) => {
      // Set state
      state.status = 'running';
      state.startTime = Date.now();
      state.startWords = currentWordCount;
      state.durationMs = Math.max(1, minutes) * 60_000;
      state.wordsGained = 0;

      // Update UI
      updatePillClasses(['running'], ['idle', 'paused', 'finished']);
      setPillAriaLabel('Sprint running, click to pause');

      // Kill any prior timer
      if (state.tock) {
        state.tock.stop();
        state.tock = null;
      }

      // Create new timer
      state.tock = new Tock({
        countdown: true,
        interval: 250,
        callback: () => {
          const left = state.tock.lap();
          const { mm, ss } = updateClockDisplay(left);

          // Hide hover when visually at 00:00
          if (mm === '00' && ss === '00') {
            els.sprintChip?.removeAttribute('data-hover');
          }
        },
        complete: () => {
          // Calculate words gained
          const finalWords = countWords(editor.value);
          state.wordsGained = Math.max(0, finalWords - state.startWords);

          // Update state
          state.status = 'finished';

          // Update UI — brief flash then reset to idle
          updatePillClasses(['finished'], ['running', 'paused']);
          setPillDisplay('▶ Sprint');
          setPillAriaLabel('Start a sprint');
          setTimeout(() => {
            updatePillClasses([], ['finished']);
          }, 500);

          // Show completion feedback
          showSprintComplete();

          // Save result
          registerSprintResult(state.wordsGained);

          // Cleanup timer
          state.tock.stop();
          state.tock = null;
          state.durationMs = 0;
        },
      });

      // Start countdown
      state.tock.start(state.durationMs);
    },

    pause: () => {
      if (state.status !== 'running' || !state.tock) return false;

      state.tock.pause();
      state.status = 'paused';

      const ms = state.tock ? state.tock.lap() : 0;
      const mm = String(Math.floor(ms / 60_000)).padStart(2, '0');
      const ss = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');

      // Update main pill
      updatePillClasses(['paused'], ['running']);
      setPillDisplay(`⏸ ${mm}:${ss}`);
      setPillAriaLabel(
        `Sprint paused at ${mm} minutes ${ss} seconds, click to resume`
      );

      // Focus mode
      if (els.focusSprint) {
        els.focusSprint.textContent = `⏸ ${mm}:${ss}`;
        els.focusSprint.setAttribute(
          'aria-label',
          `Sprint paused at ${mm} minutes ${ss} seconds, click to resume`
        );
        els.focusSprint.classList.add('paused');
      }

      return true;
    },

    resume: () => {
      if (state.status !== 'paused' || !state.tock) return false;

      state.tock.pause(); // Tock uses pause() to toggle
      state.status = 'running';

      // Update main pill
      updatePillClasses(['running'], ['paused']);
      setPillAriaLabel('Sprint running, click to pause');

      // Focus mode: remove paused state
      if (els.focusSprint) {
        els.focusSprint.classList.remove('paused');
        els.focusSprint.removeAttribute('aria-label');
      }

      return true;
    },

    reset: () => {
      if (state.tock) {
        state.tock.stop();
        state.tock.reset();
        state.tock = null;
      }

      state.status = 'idle';
      state.durationMs = 0;
      state.startTime = 0;
      state.startWords = 0;
      state.wordsGained = 0;

      // Update main pill
      updatePillClasses([], ['running', 'paused', 'finished']);
      setPillDisplay('▶ Sprint');
      setPillAriaLabel('Start a sprint');

      // Update focus mode
      if (els.focusSprint) {
        els.focusSprint.textContent = '';
        els.focusSprint.classList.remove('paused');
        els.focusSprint.removeAttribute('aria-label');
      }
    },
    async end(userCancelled = false) {
      const wordsGained = Math.max(
        0,
        countWords(editor.value) - state.startWords
      );

      if (!userCancelled && wordsGained > 0) {
        await registerSprintResult(wordsGained);
      }

      this.reset();
      await updateSessionStats();
    },
  };
};

// Create the singleton instance
const sprintManager = createSprintManager();

// ---------- Configuration Constants ----------
// Time is in milliseconds (ms)
const AUTOSAVE_INTERVAL_MS = 1000;
const TOAST_INTERVAL_MS = 600000; // 10 minutes
const TYPING_BURST_THRESHOLD_MS = 3000; // Time of inactivity before a typing burst is considered complete
const STATS_UPDATE_INTERVAL_MS = 5000;

// UI Constants
const RING_RADIUS = 18; // SVG progress ring radius (matches viewBox circle r="18")

// ---------- Cached Elements ----------
const els = {
  sidebar: document.getElementById('sidebar'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  aboutPanel: document.getElementById('aboutPanel'),
  aboutToggle: document.getElementById('aboutToggle'),
  aboutClose: document.getElementById('aboutClose'),
  exportMenu: document.getElementById('exportMenu'),
  exportBtn: document.getElementById('exportBtn'),
  // Unified sprint pill
  sprintPill: document.getElementById('sprintPill'),
  sprintDisplay: document.getElementById('sprintDisplay'),
  sprintPopover: document.getElementById('sprintPopover'),
  streakCount: document.getElementById('streakCount'),
  streakRecord: document.getElementById('streakRecord'),
  ringSvg: document.querySelector('.ring'),
  // Session stats
  statWords: document.getElementById('statWords'),
  statMinutes: document.getElementById('statMinutes'),
  statBestSprint: document.getElementById('statBestSprint'),
  statSprints: document.getElementById('statSprints'),
  // Controls
  clearBtn: document.getElementById('clearBtn'),
  clearMenu: document.getElementById('clearMenu'),
  clearEditorBtn: document.getElementById('clearEditorBtn'),
  newSessionBtn: document.getElementById('newSessionBtn'),
  saveBtn: document.getElementById('saveBtn'),
  focusBtn: document.getElementById('focusBtn'),
  exitFocus: document.getElementById('exitFocus'),
  importFile: document.getElementById('importFile'),
  resetStreakBtn: document.getElementById('resetStreakBtn'),
  footerRight: document.querySelector('.footer .right'),
  sprintBanner: document.getElementById('sprintBanner'),
  chime: document.getElementById('chime'),
  // Focus mode footer
  focusFooter: document.getElementById('focusFooter'),
  focusWords: document.getElementById('focusWords'),
  focusGoal: document.getElementById('focusGoal'),
  focusPercent: document.getElementById('focusPercent'),
  focusBar: document.getElementById('focusBar'),
  focusSprint: document.getElementById('focusSprint'),
  // Goal chip (editable)
  goalChip: document.getElementById('goalChip'),
  goalInputNew: document.getElementById('goalInputNew'),
  goalDisplay: document.getElementById('goalDisplay'),
  goalEdit: document.querySelector('.goal-edit'),
  goalDisplay: document.querySelector('.goal-display'),
  goalEdit: document.querySelector('.goal-edit'),

  incGoalNew: document.getElementById('incGoalNew'),
  decGoalNew: document.getElementById('decGoalNew'),
};

function countWords(text) {
  // Robust-ish word count: split on whitespace & em dashes, ignore stray punctuation
  const cleaned = text.replace(/—/g, ' ').replace(/[\n\t]+/g, ' ');
  const arr = cleaned.trim().split(/\s+/).filter(Boolean);
  return arr.length ? arr.length : 0;
}

/**
 * Generates a date stamp (YYYY-MM-DD) based on the user's local time zone.
 * This prevents the "ahead of time" issue caused by using UTC.
 * @returns {string} The local date stamp (e.g., "2025-11-20").
 */
function getLocalExportStamp() {
  const now = new Date();
  const year = now.getFullYear();
  // Month is 0-indexed, so add 1
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// YYYY-MM-DD for the user's local day (midnight)
function getLocalDateStamp() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------- State ----------
const appState = {
  // Typing tracker state
  typing: {
    burstTimer: null,
    startTimestamp: null,
    totalTime: 0,
    date: new Date().toDateString(),
  },

  // General app state
  startTime: Date.now(),
  lastSavedAt: 0,
  lastToastAt: 0,
  lastWordCount: countWords(editor.value),
  peakWordCount: 0,
  lastSyncedWords: 0,
  focus: false,
  wasGoalComplete: false,
};

// Helper: reset if day changed
async function resetTypingTimeIfNewDay() {
  // <-- ADD async
  const today = new Date().toDateString();
  if (today !== appState.typing.date) {
    appState.typing.date = today;
    appState.typing.totalTime = 0;
    // --- NEW: Use storage.set() ---
    await storage.set('wt:typingTime', {
      // <-- Use await storage.set
      date: appState.typing.date,
      time: appState.typing.totalTime,
    });
  }
}

// ---------- Theme ----------
async function applyTheme(dark) {
  document.body.classList.toggle('dark', !!dark);
  themeToggle.classList.toggle('active', !!dark);
  themeToggle.setAttribute('aria-checked', !!dark);
  // --- NEW: Use storage.set() ---
  await storage.set(STORAGE_KEYS.theme, dark ? 'dark' : 'light');
}

// (Theme is initialized inside loadState())

// Toggle on click
themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark');
  applyTheme(!isDark);
});

// Keyboard support for theme toggle
themeToggle.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    const isDark = document.body.classList.contains('dark');
    applyTheme(!isDark);
  }
});

async function loadState() {
  try {
    const savedText = await storage.get(STORAGE_KEYS.text);
    const savedGoal = await storage.get(STORAGE_KEYS.goal);
    const savedTheme = await storage.get(STORAGE_KEYS.theme);

    if (savedText != null) editor.value = savedText;
    if (savedGoal != null) goalInput.value = parseInt(savedGoal, 10) || 1000;

    await applyTheme(savedTheme === 'dark');
    // Set peak before updateAll to prevent false word counts
    appState.peakWordCount = countWords(editor.value);
    appState.lastWordCount = countWords(editor.value);
    appState.lastSyncedWords = countWords(editor.value);
    updateAll();
  } catch (err) {
    errorHandler.error(err, 'loadState', { notify: false });
    // Continue with defaults
    goalInput.value = 1000;
    await applyTheme(false);
    updateAll();
  }
}

// ---------- Progress + Stats ----------
function updateAll() {
  // sanitize goal: force number, clamp between 1 and 999999
  let goal = parseInt(goalInput.value, 10);
  if (isNaN(goal) || goal < 1) goal = 1;
  if (goal > 999999) goal = 999999;

  // Calculate all values first (no DOM access)
  const words = countWords(editor.value);
  const remaining = Math.max(0, goal - words);
  const pct = Math.min(100, Math.round((words / goal) * 100));
  const CIRC = 2 * Math.PI * RING_RADIUS;
  const offset = CIRC * (1 - pct / 100);
  const isGoalComplete = pct >= 100;

  // Batch all DOM updates in a single animation frame
  requestAnimationFrame(() => {
    // Update input and text elements
    goalInput.value = goal;
    if (goalDisplay) goalDisplay.textContent = goal.toLocaleString();
    if (wordsEl) wordsEl.textContent = words.toLocaleString();
    if (remainingEl) remainingEl.textContent = remaining.toLocaleString();

    // Update progress bar and ring
    if (bar) bar.style.width = pct + '%';

    if (ring) {
      ring.setAttribute('stroke-dasharray', CIRC.toFixed(1));
      ring.setAttribute('stroke-dashoffset', offset.toFixed(1));
    }

    if (ringLabel) ringLabel.textContent = pct + '%';

    // Toggle ring completion styling
    if (els.ringSvg) {
      els.ringSvg.classList.toggle('complete', isGoalComplete);
    }

    // Update document title
    document.title = `✍️ ${words}/${goal} — Writing Goal Tracker`;
    // Update focus mode footer if visible
    if (els.focusWords) els.focusWords.textContent = words.toLocaleString();
    if (els.focusGoal) els.focusGoal.textContent = goal.toLocaleString();
    if (els.focusPercent) els.focusPercent.textContent = pct;
    if (els.focusBar) els.focusBar.style.width = pct + '%';

    // Handle celebration - This section replaces the old toggle/trigger.
    const isNewCompletion = isGoalComplete && !appState.wasGoalComplete;

    if (isNewCompletion) {
      showCelebrate();
    }

    // Update state for the next input event
    appState.wasGoalComplete = isGoalComplete;
  });
}

// Debounced version for use during rapid typing (16ms ≈ 60fps)
const debouncedUpdateAll = debounce(updateAll, 16);

// Debounced stats update to stay in sync with display
const debouncedStatsUpdate = debounce(() => {
  const currentWords = countWords(editor.value);
  const wordsGained = Math.max(0, currentWords - appState.lastSyncedWords);
  if (wordsGained > 0) {
    appState.lastSyncedWords = currentWords;
    updateAllStatsTransaction(wordsGained).then(() => {
      updateSessionStats();
      updateStreakUI();
    });
  }
}, 16);

// ---------- Celebrate ----------
function showCelebrate() {
  // Select a random message from the array
  const message =
    CELEBRATION_MESSAGES[
      Math.floor(Math.random() * CELEBRATION_MESSAGES.length)
    ];

  // Update the banner's content (NO EMOJI in the text now, CSS handles it)
  celebrate.innerHTML = message;

  celebrate.classList.add('show');
  burstConfetti();

  // Trigger ring celebration glow
  if (els.ringSvg) {
    els.ringSvg.classList.add('celebrating');
  }

  // Schedule the removal after 3 seconds
  setTimeout(() => {
    celebrate.classList.remove('show');

    // Fade ring back to green complete state
    if (els.ringSvg) {
      els.ringSvg.classList.remove('celebrating');
    }
  }, 3000);
}

function burstConfetti() {
  try {
    for (let i = 0; i < 40; i++) createConfetto(i);
  } catch (err) {
    errorHandler.info(err, 'confetti', { silent: true });
  }

  function createConfetto(index) {
    const isDark = document.body.classList.contains('dark');
    const palette = isDark ? CONFETTI_PALETTES.dark : CONFETTI_PALETTES.light;

    // 20% warm (gold) for brand cohesion with celebration banner
    const useWarm = index % 5 === 0;
    const colorPool = useWarm ? palette.warm : palette.cool;
    const color = colorPool[Math.floor(Math.random() * colorPool.length)];

    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = color;
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(c);

    const fall = 800 + Math.random() * 900;
    const drift = Math.random() * 40 - 20;

    try {
      c.animate(
        [
          { transform: c.style.transform + ' translate(0,0)', opacity: 1 },
          {
            transform: `rotate(${
              Math.random() * 360
            }deg) translate(${drift}vw, 100vh)`,
            opacity: 0.6,
          },
        ],
        { duration: fall, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' }
      );
    } catch (animErr) {
      errorHandler.info(animErr, 'confettiAnimation', { silent: true });
    }

    setTimeout(() => {
      try {
        c.remove();
      } catch (removeErr) {
        // Element may have already been removed
      }
    }, fall + 100);
  }
}

// ---------- Persistence ----------

async function save(showToast = false) {
  try {
    await storage.set(STORAGE_KEYS.text, editor.value);
    await storage.set(STORAGE_KEYS.goal, parseInt(goalInput.value, 10) || 1000);
    appState.lastSavedAt = Date.now();

    if (showToast) {
      showSaveToast();
      appState.lastToastAt = Date.now();
    }
  } catch (err) {
    errorHandler.error(err, 'save', { notify: true });
  }
}

let saveInProgress = false;

async function throttledSave() {
  if (saveInProgress) return;

  if (Date.now() - appState.lastSavedAt > AUTOSAVE_INTERVAL_MS) {
    saveInProgress = true;

    try {
      await save();
      appState.lastSavedAt = Date.now();

      if (Date.now() - appState.lastToastAt > TOAST_INTERVAL_MS) {
        showSaveToast();
        appState.lastToastAt = Date.now();
      }
    } catch (err) {
      errorHandler.warn(err, 'autosave', { silent: false });
    } finally {
      saveInProgress = false;
    }
  }
}

function showSaveToast() {
  const toast = document.getElementById('saveToast');
  if (!toast) return;
  toast.classList.add('show');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 1500);
}

// ---------- Sprints ----------

async function endSprint(userCancelled = false) {
  appState.sprint.status = 'idle';
  const wordsGained = Math.max(
    0,
    countWords(editor.value) - appState.sprint.startWords
  );

  if (!userCancelled && wordsGained > 0) {
    await registerSprintResult(wordsGained);
  }

  // Reset sprint state variables
  appState.sprint.startWords = 0;
  appState.sprint.startTime = 0;

  updateSprintButton('idle');
  await updateSessionStats();
}

function pulseFooter() {
  els.footerRight.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.03)' },
      { transform: 'scale(1)' },
    ],
    { duration: 800, iterations: 2 }
  );
}

// ---------- Daily Streak Tracker ----------
async function updateStreakUI() {
  // 1. READ ONLY: Use storage.get() to READ the committed data.
  // The data has already been saved by updateAllStatsTransaction.
  const streak = (await storage.get('wt:streakData')) || {
    count: 0,
    record: 0,
    lastDate: null,
  };

  // 2. UI Update ONLY: Update the HTML elements with null checks
  if (els.streakCount) els.streakCount.textContent = streak.count;
  if (els.streakRecord)
    els.streakRecord.textContent = `(Record: ${streak.record})`;
}

// Reset with dramatic confirmation
els.resetStreakBtn.addEventListener('click', async () => {
  const messages = [
    'Are you SURE you want to destroy your glorious writing streak?',
    'The literary gods will weep...',
    'Seriously though, reset? 🥺',
  ];
  const confirmReset = confirm(messages.join('\n'));
  if (confirmReset) {
    await storage.remove('wt:streakData');
    await updateStreakUI();
  }
});

// ---------- Appearance Controls ----------
const fontSizeSlider = document.getElementById('fontSizeSlider');
const fontStyleToggle = document.getElementById('fontStyleToggle');
const APPEARANCE_KEY = 'wt:appearance';

async function loadAppearance() {
  // --- Use await storage.get() ---
  const saved = (await storage.get(APPEARANCE_KEY)) || {};

  // Migrate old shape { serif: boolean } → { sans: boolean }, default serif
  const size = Number(saved.size) || 18;
  const useSans =
    typeof saved.sans === 'boolean'
      ? saved.sans
      : typeof saved.serif === 'boolean'
      ? saved.serif /* old “active” meant sans */
      : false;

  document.documentElement.style.setProperty('--editor-font-size', `${size}px`);

  // Apply: sans=true → body.sans, else → body.serif (default serif)
  document.body.classList.toggle('sans', useSans);
  document.body.classList.toggle('serif', !useSans);

  // Sync control
  fontSizeSlider.value = size;
  fontStyleToggle.classList.toggle('active', useSans); // active = sans
  fontStyleToggle.setAttribute('aria-checked', String(useSans));

  // Persist normalized shape if needed
  if ('serif' in saved || !('sans' in saved)) {
    // --- NEW: Use await storage.set() ---
    await storage.set(APPEARANCE_KEY, { size, sans: useSans });
  }
}

async function saveAppearance() {
  const size = Number(fontSizeSlider.value) || 18;
  const useSans = fontStyleToggle.classList.contains('active'); // active = sans
  // --- Use await storage.set() ---
  await storage.set(APPEARANCE_KEY, { size, sans: useSans });
}

fontSizeSlider.addEventListener('input', async (e) => {
  const size = e.target.value;
  document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
  await saveAppearance();
});

fontSizeSlider.addEventListener('dblclick', async () => {
  fontSizeSlider.value = 18; // 🎯 baseline size
  document.documentElement.style.setProperty('--editor-font-size', '18px');
  await saveAppearance();
});

fontStyleToggle.addEventListener('click', async () => {
  const useSans = fontStyleToggle.classList.toggle('active');
  document.body.classList.toggle('sans', useSans);
  document.body.classList.toggle('serif', !useSans);
  fontStyleToggle.setAttribute('aria-checked', useSans);
  await saveAppearance();
});

fontStyleToggle.addEventListener('keydown', async (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    const useSans = fontStyleToggle.classList.toggle('active'); // active = sans
    document.body.classList.toggle('sans', useSans);
    document.body.classList.toggle('serif', !useSans);
    fontStyleToggle.setAttribute('aria-checked', String(useSans));
    await saveAppearance();
  }
});

loadAppearance();

// ---------- Sprint Complete ----------
function showSprintComplete() {
  pulseFooter();

  if (els.sprintBanner) {
    els.sprintBanner.classList.remove('hide');
    els.sprintBanner.classList.add('show');
    setTimeout(() => {
      els.sprintBanner.classList.add('hide');
      els.sprintBanner.classList.remove('show');
    }, 4000);
  }

  if (els.chime) {
    els.chime.currentTime = 0;
    els.chime.play().catch(() => {});
  }
}

// ---------- Focus Mode ----------

function toggleFocus() {
  appState.focus = !appState.focus;

  document.body.classList.toggle('focus-mode', appState.focus);

  // Hide or show header/footer
  document.querySelector('.header').style.display = appState.focus
    ? 'none'
    : '';
  document.querySelector('.footer').style.display = appState.focus
    ? 'none'
    : '';

  // Keep About panel accessible in focus mode
  document.body.classList.toggle(
    'about-open',
    els.aboutPanel?.classList.contains('open')
  );

  // Show or hide the floating exit button
  const exitBtn = document.getElementById('exitFocus');
  if (exitBtn) {
    if (appState.focus) {
      exitBtn.classList.add('show');
    } else {
      exitBtn.classList.remove('show');
    }
  }
}

// ---------- Export / Import ----------
function exportTxt() {
  const blob = new Blob([editor.value], { type: 'text/plain' });
  const a = document.createElement('a');
  const stamp = getLocalExportStamp();
  a.href = URL.createObjectURL(blob);
  a.download = `writing-${stamp}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function exportDocx() {
  if (!window.docx || !window.docx.Packer) {
    errorHandler.warn('docx library not loaded', 'exportDocx', {
      notify: true,
    });
    return;
  }

  let objectUrl = null;

  try {
    const { Document, Packer, Paragraph, TextRun } = window.docx;

    const paragraphs = editor.value.split(/\n/g).map(
      (line) =>
        new Paragraph({
          children: [new TextRun(line)],
        })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }],
    });

    const blob = await Packer.toBlob(doc);
    const stamp = getLocalExportStamp();

    const a = document.createElement('a');
    objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = `writing-${stamp}.docx`;
    a.click();
  } catch (err) {
    errorHandler.error(err, 'exportDocx', { notify: true });
  } finally {
    if (objectUrl) {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
    }
  }
}

function exportMarkdown() {
  let md = editor.value;

  // Simple conversions: double newlines become section breaks
  md = md.replace(/\r?\n\r?\n/g, '\n\n');

  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  const stamp = getLocalExportStamp();
  a.href = URL.createObjectURL(blob);
  a.download = `writing-${stamp}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Import Any Text-Based Format ----------
async function importFileHandler(file) {
  if (!file) return;

  const fileName = file.name || '';
  const ext = fileName.toLowerCase().split('.').pop();

  let formattingWarning = '';

  if (ext === 'docx') {
    formattingWarning =
      '\n\nNote: All formatting (bold, italics, headings, lists, images) will be removed.';
  } else if (ext === 'md') {
    formattingWarning = '\n\nMarkdown syntax will be preserved.';
  } else if (!['txt', 'docx', 'md'].includes(ext)) {
    formattingWarning = '\n\nFile type is unusual. Formatting may be lost.';
  }

  if (editor.value.trim().length > 0) {
    const proceed = confirm(
      `Importing will overwrite the current text.${formattingWarning}\n\nContinue?`
    );
    if (!proceed) return;
  }

  // ----- TXT + MD -----
  if (ext === 'txt' || ext === 'md') {
    try {
      const text = await file.text();
      editor.value = text;
      updateAll();
      save();
    } catch (err) {
      errorHandler.error(err, 'importText', { notify: true });
    }
    return;
  }

  // ----- DOCX -----
  if (ext === 'docx') {
    if (
      !window.mammoth ||
      typeof window.mammoth.extractRawText !== 'function'
    ) {
      errorHandler.warn('mammoth library not loaded', 'importDocx', {
        notify: true,
      });
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      editor.value = result.value || '';
      updateAll();
      save();
    } catch (err) {
      errorHandler.error(err, 'importDocx', { notify: true });
    }
    return;
  }

  // Final fallback for truly unsupported files
  errorHandler.warn('Unsupported file type', 'import', { notify: true });
}

// ---------- Sidebar Session Stats + Streak Tracking ----------
async function updateSessionStats() {
  const todayStamp = getLocalDateStamp();

  // 1. Load data
  let session = (await storage.get('wt:sessionStats')) || {
    date: todayStamp,
    words: 0,
    minutes: 0,
    sprints: 0,
    bestSprint: 0,
  };

  // 2. New calendar day → reset stats for today
  if (session.date !== todayStamp) {
    session = {
      date: todayStamp,
      words: 0,
      minutes: 0,
      sprints: 0,
      bestSprint: 0,
    };
  }

  // 3. Update minutes for display
  const savedTyping = await storage.get('wt:typingTime', { time: 0 });
  const mins = Math.floor(savedTyping.time / 60000);
  session.minutes = mins;

  // 4. Update UI (Read-Only) with null checks
  const wordsToday = session.words;
  if (els.statWords) els.statWords.textContent = wordsToday;
  if (els.statMinutes) els.statMinutes.textContent = session.minutes;
  if (els.statSprints) els.statSprints.textContent = session.sprints;
  if (els.statBestSprint) els.statBestSprint.textContent = session.bestSprint;
}

/**
 * CRITICAL: Atomically updates all typing-related stats in a single transaction.
 * This prevents race conditions during rapid typing.
 * @param {number} wordsGained - The word delta from the last input event.
 */
async function updateAllStatsTransaction(wordsGained) {
  const todayStamp = getLocalDateStamp();

  try {
    await db.transaction('rw', db.content, async (tx) => {
      const typingTimePromise = tx.content.get('wt:typingTime');
      const sessionStatsPromise = tx.content.get('wt:sessionStats');
      const streakDataPromise = tx.content.get('wt:streakData');

      const [savedTyping, session, streak] = await Promise.all([
        typingTimePromise,
        sessionStatsPromise,
        streakDataPromise,
      ]);

      let currentStreak = streak?.value || {
        count: 0,
        record: 0,
        lastDate: null,
      };

      if (wordsGained > 0 && currentStreak.lastDate !== todayStamp) {
        const last = new Date(currentStreak.lastDate);
        const diff = (new Date(todayStamp) - last) / 86400000;
        currentStreak.count = diff === 1 ? currentStreak.count + 1 : 1;
        currentStreak.lastDate = todayStamp;
        currentStreak.record = Math.max(
          currentStreak.record,
          currentStreak.count
        );

        await tx.content.put({ key: 'wt:streakData', value: currentStreak });
      }

      let currentSession = session?.value || {
        date: todayStamp,
        words: 0,
        minutes: 0,
        sprints: 0,
        bestSprint: 0,
      };

      if (currentSession.date !== todayStamp) {
        currentSession = {
          date: todayStamp,
          words: 0,
          minutes: 0,
          sprints: 0,
          bestSprint: 0,
        };
      }

      const mins = Math.floor((savedTyping?.value?.time || 0) / 60000);
      currentSession.minutes = mins;
      currentSession.words += wordsGained;

      await tx.content.put({ key: 'wt:sessionStats', value: currentSession });
    });
  } catch (err) {
    errorHandler.critical(err, 'statsTransaction', { silent: false });
  }
}

// ---------- Sidebar Sprint Tracking Integration ----------
async function registerSprintResult(wordsGained) {
  // <-- ADD async
  // --- NEW: Use await storage.get() ---
  let session = await storage.get('wt:sessionStats');
  if (!session) return;

  session.sprints = (session.sprints || 0) + 1;
  session.bestSprint = Math.max(session.bestSprint || 0, wordsGained || 0);

  // --- Use await storage.set() ---
  await storage.set('wt:sessionStats', session);
  await updateSessionStats();
}

// ---------- Events ----------
editor.addEventListener('input', async (e) => {
  await resetTypingTimeIfNewDay();

  const now = Date.now();

  // If a burst just started, record the start time
  if (!appState.typing.startTimestamp) {
    appState.typing.startTimestamp = now;
  }

  // 1. Clear any pending burst timer
  clearTimeout(appState.typing.burstTimer);

  // 2. Schedule burst end: runs after 3s of *no typing*
  appState.typing.burstTimer = setTimeout(async () => {
    if (appState.typing.startTimestamp) {
      const burstDuration = Date.now() - appState.typing.startTimestamp;
      appState.typing.totalTime += burstDuration;
      appState.typing.startTimestamp = null;
      appState.typing.burstTimer = null;

      // Persist total typing time
      // --- Use await storage.set() ---
      await storage.set(
        // <-- Use await storage.set
        'wt:typingTime',
        {
          date: appState.typing.date,
          time: appState.typing.totalTime,
        }
      );
    }
  }, TYPING_BURST_THRESHOLD_MS);

  // ---------- Update "words typed today" ----------
  const currentCount = countWords(editor.value);

  // Only trigger stats update when words increase
  if (currentCount > appState.peakWordCount) {
    appState.peakWordCount = currentCount;
    debouncedStatsUpdate();
  }

  // Update the last known count for next input event
  appState.lastWordCount = currentCount;

  // Always update word count display and trigger autosave
  debouncedUpdateAll();
  throttledSave();
});

// ---------- Prevent Multiple Stats Timers ----------
// Clear any existing timer first to prevent duplicates
if (window._sessionStatsTimer) {
  clearInterval(window._sessionStatsTimer);
}

// Create the timer
window._sessionStatsTimer = setInterval(
  updateSessionStats,
  STATS_UPDATE_INTERVAL_MS
); // refresh every 5 sec

goalInput.addEventListener('change', async () => {
  updateAll();
  await save();
});

// ---------- Editable Goal Chip ----------
function openGoalEdit() {
  if (!els.goalChip) return;
  els.goalChip.classList.add('editing');
  els.goalInputNew.value = goalInput.value;
  els.goalInputNew.removeAttribute('hidden');
  els.goalInputNew.parentElement.removeAttribute('hidden');
  setTimeout(() => {
    els.goalInputNew.focus();
    els.goalInputNew.select();
  }, 10);
}

function closeGoalEdit(saveChanges = true) {
  if (!els.goalChip) return;
  if (saveChanges) {
    const newVal = parseInt(els.goalInputNew.value, 10);
    if (!isNaN(newVal) && newVal >= 1) {
      goalInput.value = newVal;
      updateAll();
      save();
    }
  }
  els.goalChip.classList.remove('editing');
  // Update aria-label with new value
  els.goalChip.setAttribute(
    'aria-label',
    `Edit word goal, currently ${goalInput.value}`
  );
  els.goalDisplay.hidden = false;
  els.goalEdit.hidden = true;
}

// Click to open edit mode
els.goalChip?.addEventListener('click', (e) => {
  // Don't re-open if clicking inside edit controls
  if (e.target.closest('.goal-edit')) return;

  if (els.goalChip.classList.contains('editing')) {
    closeGoalEdit(true);
  } else {
    openGoalEdit();
  }
});

// Keyboard support for goal chip
els.goalChip?.addEventListener('keydown', (e) => {
  // Ignore key presses that originate inside the editor controls
  if (e.target.closest('.goal-edit')) return;

  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (els.goalChip.classList.contains('editing')) {
      closeGoalEdit(true);
    } else {
      openGoalEdit();
    }
  }
  if (e.key === 'Escape') {
    closeGoalEdit(false);
  }
});

// Close when clicking outside
document.addEventListener('click', (e) => {
  if (!els.goalChip?.classList.contains('editing')) return;
  if (!els.goalChip.contains(e.target)) {
    closeGoalEdit(true);
  }
});

// Enter to confirm in input
els.goalInputNew?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    closeGoalEdit(true);
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    closeGoalEdit(false);
  }
});

// +/- buttons in edit mode
els.incGoalNew?.addEventListener('click', async (e) => {
  e.stopPropagation();
  els.goalInputNew.value = (+els.goalInputNew.value || 0) + 100;
});

els.decGoalNew?.addEventListener('click', async (e) => {
  e.stopPropagation();
  els.goalInputNew.value = Math.max(1, (+els.goalInputNew.value || 0) - 100);
});

// ---------- Unified Sprint Pill ----------
function openSprintPopover() {
  if (!els.sprintPopover) return;
  els.sprintPill.classList.add('menu-open');

  // Update popover content based on state
  if (sprintManager.isPaused()) {
    els.sprintPopover.innerHTML = `
      <button class="sprint-option" role="menuitem" data-action="resume">▶ Resume</button>
      <button class="sprint-option sprint-option-danger" role="menuitem" data-action="reset">✕ Reset</button>
    `;
  } else {
    els.sprintPopover.innerHTML = `
      <button class="sprint-option" role="menuitem" data-mins="15">15 min</button>
      <button class="sprint-option" role="menuitem" data-mins="25">25 min</button>
    `;
  }

  els.sprintPopover.classList.add('open');
  els.sprintPopover.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    els.sprintPopover.querySelector('.sprint-option')?.focus();
  });
}
function closeSprintPopover() {
  if (!els.sprintPopover) return;
  els.sprintPill.classList.remove('menu-open');
  els.sprintPopover.classList.remove('open');
  els.sprintPopover.setAttribute('aria-hidden', 'true');
}

// Click handler for sprint pill
els.sprintPill?.addEventListener('click', (e) => {
  // If clicking inside popover, let it handle itself
  if (e.target.closest('.sprint-popover')) return;

  if (sprintManager.isIdle()) {
    // Toggle popover
    const isOpen = els.sprintPopover?.classList.contains('open');
    isOpen ? closeSprintPopover() : openSprintPopover();
  } else if (sprintManager.isRunning()) {
    sprintManager.pause();
  } else if (sprintManager.isPaused()) {
    // Show popover with resume/reset options
    const isOpen = els.sprintPopover?.classList.contains('open');
    isOpen ? closeSprintPopover() : openSprintPopover();
  }
});

// Keyboard support for sprint pill
els.sprintPill?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (sprintManager.isIdle()) {
      const isOpen = els.sprintPopover?.classList.contains('open');
      isOpen ? closeSprintPopover() : openSprintPopover();
    } else if (sprintManager.isRunning()) {
      sprintManager.pause();
    } else if (sprintManager.isPaused()) {
      sprintManager.resume();
    }
  }
  if (e.key === 'Escape') {
    closeSprintPopover();
  }
});

// Duration/action selection from popover
els.sprintPopover?.addEventListener('click', (e) => {
  const btn = e.target.closest('.sprint-option');
  if (!btn) return;

  const action = btn.dataset.action;
  const mins = btn.dataset.mins;

  closeSprintPopover();

  if (action === 'resume') {
    sprintManager.resume();
  } else if (action === 'reset') {
    sprintManager.reset();
  } else if (mins) {
    sprintManager.start(Number(mins), countWords(editor.value));
  }
});

// Close popover when clicking outside
document.addEventListener('click', (e) => {
  if (!els.sprintPopover?.classList.contains('open')) return;
  if (!els.sprintPill?.contains(e.target)) {
    closeSprintPopover();
  }
});

// Keyboard navigation in popover
els.sprintPopover?.addEventListener('keydown', (e) => {
  const options = Array.from(
    els.sprintPopover.querySelectorAll('.sprint-option')
  );
  const idx = options.indexOf(document.activeElement);

  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    e.preventDefault();
    options[(idx + 1) % options.length]?.focus();
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault();
    options[(idx - 1 + options.length) % options.length]?.focus();
  }
  if (e.key === 'Escape') {
    closeSprintPopover();
    els.sprintPill?.focus();
  }
});

document.querySelectorAll('[data-preset]').forEach((p) =>
  p.addEventListener('click', async () => {
    goalInput.value = p.dataset.preset;
    updateAll();
    await save();
  })
);

// Focus mode sprint: pause/resume on click
els.focusSprint?.addEventListener('click', () => {
  if (sprintManager.isRunning()) {
    sprintManager.pause();
  } else if (sprintManager.isPaused()) {
    sprintManager.resume();
  }
});

document.querySelectorAll('.export-option').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const type = e.currentTarget.dataset.type;
    if (e.currentTarget.getAttribute('aria-disabled') === 'true') {
      // Mirror the same message users see elsewhere
      if (type === 'docx')
        alert('DOCX export is unavailable. The docx library failed to load.');
      return;
    }

    // If DOCX lib is missing, alert and KEEP the menu open
    if (type === 'docx' && !(window.docx && window.docx.Packer)) {
      alert('DOCX export is unavailable. The docx library failed to load.');
      return;
    }

    // Only close once we know we can proceed
    closeExportMenu(true);
    if (type === 'txt') exportTxt();
    if (type === 'docx') exportDocx();
    if (type === 'md') exportMarkdown();
  });
});

// ---------- Clear Menu ----------
function openClearMenu() {
  els.clearMenu.classList.add('open');
  els.clearMenu.setAttribute('aria-hidden', 'false');
  els.clearBtn.setAttribute('aria-expanded', 'true');
  els.clearEditorBtn?.focus();
}

function closeClearMenu(returnFocus = true) {
  els.clearMenu.classList.remove('open');
  els.clearMenu.setAttribute('aria-hidden', 'true');
  els.clearBtn.setAttribute('aria-expanded', 'false');
  if (returnFocus) els.clearBtn.focus();
}

els.clearBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (els.clearMenu.classList.contains('open')) {
    closeClearMenu(false);
  } else {
    openClearMenu();
  }
});

els.clearEditorBtn?.addEventListener('click', async () => {
  closeClearMenu(false);
  if (confirm('Clear the editor? This will remove current text.')) {
    editor.value = '';
    appState.startTime = Date.now();
    updateAll();
    await save();
  }
});

els.newSessionBtn?.addEventListener('click', async () => {
  closeClearMenu(false);
  const confirmReset = confirm(
    "Start a new session?\n\nThis will clear the editor AND reset today's stats (words, minutes, sprints).\n\nYour daily streak will be preserved."
  );
  if (confirmReset) {
    // Clear editor
    editor.value = '';
    appState.startTime = Date.now();

    // Reset today's stats
    const todayStamp = getLocalDateStamp();
    await storage.set('wt:sessionStats', {
      date: todayStamp,
      words: 0,
      minutes: 0,
      sprints: 0,
      bestSprint: 0,
    });

    // Reset typing time
    await storage.set('wt:typingTime', {
      date: appState.typing.date,
      time: 0,
    });
    appState.typing.totalTime = 0;

    // Reset tracking state
    appState.peakWordCount = 0;
    appState.lastSyncedWords = 0;
    appState.lastWordCount = 0;

    updateAll();
    await save();
    await updateSessionStats();
  }
});

// Close clear menu when clicking outside
document.addEventListener('click', (e) => {
  if (!els.clearMenu?.classList.contains('open')) return;
  if (!els.clearBtn?.contains(e.target) && !els.clearMenu?.contains(e.target)) {
    closeClearMenu(false);
  }
});

// Keyboard support for clear menu
els.clearMenu?.addEventListener('keydown', (e) => {
  const items = Array.from(els.clearMenu.querySelectorAll('.export-option'));
  const idx = items.indexOf(document.activeElement);

  if (e.key === 'Escape') {
    e.preventDefault();
    closeClearMenu(true);
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    items[(idx + 1) % items.length]?.focus();
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    items[(idx - 1 + items.length) % items.length]?.focus();
  }
});

els.saveBtn.addEventListener('click', async () => await save(true));

// Export menu helpers (keep ARIA in sync)
function openExportMenu() {
  els.exportMenu.classList.add('open');
  els.exportMenu.setAttribute('aria-hidden', 'false');
  els.exportBtn.setAttribute('aria-expanded', 'true');

  const items = Array.from(
    els.exportMenu.querySelectorAll(
      '.export-option:not([aria-disabled="true"])'
    )
  );
  if (items.length) items[0].focus();
}

function closeExportMenu(returnFocus = true) {
  els.exportMenu.classList.remove('open');
  els.exportMenu.setAttribute('aria-hidden', 'true');
  els.exportBtn.setAttribute('aria-expanded', 'false');
  if (returnFocus) els.exportBtn.focus();
}

// Single click handler (no duplicates)
els.exportBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (els.exportMenu.classList.contains('open')) {
    closeExportMenu(false);
  } else {
    openExportMenu();
  }
});

// Open via keyboard from the button
els.exportBtn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
    e.preventDefault();
    openExportMenu();
  }
});

// Close on Escape, trap Tab inside, and arrow navigate items
els.exportMenu.addEventListener('keydown', (e) => {
  const items = Array.from(els.exportMenu.querySelectorAll('.export-option'));
  const idx = items.indexOf(document.activeElement);

  if (e.key === 'Escape') {
    e.preventDefault();
    closeExportMenu(true);
    return;
  }

  if (e.key === 'Tab') {
    // trap focus within the menu
    e.preventDefault();
    if (items.length === 0) return;
    if (e.shiftKey) {
      items[(idx - 1 + items.length) % items.length].focus();
    } else {
      items[(idx + 1) % items.length].focus();
    }
    return;
  }

  if (e.key === 'ArrowDown' && items.length) {
    e.preventDefault();
    items[(idx + 1) % items.length].focus();
  }
  if (e.key === 'ArrowUp' && items.length) {
    e.preventDefault();
    items[(idx - 1 + items.length) % items.length].focus();
  }
});

els.importFile.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (f) await importFileHandler(f);
  e.target.value = '';
});

els.focusBtn.addEventListener('click', toggleFocus);
els.exitFocus.addEventListener('click', toggleFocus);

// Shortcuts
window.addEventListener('keydown', async (e) => {
  const key = e.key.toLowerCase();

  // Manual Save
  if ((e.metaKey || e.ctrlKey) && key === 's') {
    e.preventDefault();
    await save(true);
    return;
  }

  // Export text
  if ((e.metaKey || e.ctrlKey) && key === 'e') {
    e.preventDefault();
    exportTxt();
    return;
  }

  // Focus mode toggle
  if ((e.metaKey || e.ctrlKey) && key === 'b') {
    e.preventDefault();
    toggleFocus();
    return;
  }
});
// ---------- Sidebar Toggle ----------
els.sidebarToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = els.sidebar.classList.toggle('open');
  document.body.classList.toggle('sidebar-open', isOpen);
  els.sidebarToggle.setAttribute('aria-expanded', String(isOpen));
  els.sidebar.setAttribute('aria-hidden', String(!isOpen));
});

// ---------- Unified Outside-Click Handling ----------
document.addEventListener('click', (e) => {
  const t = e.target;

  // ----- Cache booleans once -----
  const sidebarOpen = els.sidebar?.classList.contains('open');
  const aboutOpen = els.aboutPanel?.classList.contains('open');
  const menuOpen = els.exportMenu?.classList.contains('open');

  const insideSidebar = !!els.sidebar && els.sidebar.contains(t);
  const insideAbout = !!els.aboutPanel && els.aboutPanel.contains(t);
  const insideMenu = !!els.exportMenu && els.exportMenu.contains(t);

  const isSidebarBtn = t === els.sidebarToggle;
  const isAboutBtn = t === els.aboutToggle;
  const isExportBtn = t === els.exportBtn;

  // ----- Close Export Menu (don’t steal focus) -----
  if (menuOpen && !insideMenu && !isExportBtn) {
    closeExportMenu(false);
  }

  // ----- Close Sidebar -----
  if (
    sidebarOpen &&
    !insideSidebar &&
    !isSidebarBtn &&
    !insideAbout &&
    !isAboutBtn
  ) {
    els.sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
    els.sidebarToggle.setAttribute('aria-expanded', 'false');
    els.sidebar.setAttribute('aria-hidden', 'true');
  }

  // ----- Close About Panel -----
  if (aboutOpen && !insideAbout && !isAboutBtn) {
    els.aboutPanel.classList.remove('open');
    els.aboutPanel.setAttribute('aria-hidden', 'true');
  }
});

// OPEN About panel
if (els.aboutToggle && els.aboutPanel) {
  els.aboutToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    els.aboutPanel.classList.add('open');
    els.aboutPanel.setAttribute('aria-hidden', 'false');
  });
}

// CLOSE About panel
if (els.aboutClose && els.aboutPanel) {
  els.aboutClose.addEventListener('click', (e) => {
    e.stopPropagation();
    els.aboutPanel.classList.remove('open');
    els.aboutPanel.setAttribute('aria-hidden', 'true');
  });
}

// Close About or Sidebar on Escape (Export menu handled elsewhere)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  // If Export menu is open, let its own handler deal with it
  if (els.exportMenu?.classList.contains('open')) return;

  // 1) Close About panel first, if open
  if (els.aboutPanel?.classList.contains('open')) {
    e.preventDefault();
    els.aboutPanel.classList.remove('open');
    els.aboutPanel.setAttribute('aria-hidden', 'true');
    els.aboutToggle?.focus();
    return;
  }

  // 2) Otherwise, close Sidebar if open
  if (els.sidebar?.classList.contains('open')) {
    e.preventDefault();
    els.sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
    els.sidebarToggle?.focus();
    els.sidebarToggle.setAttribute('aria-expanded', 'false');
    els.sidebar.setAttribute('aria-hidden', 'true');
  }
});

async function init() {
  els.ringSvg = document.querySelector('.ring'); // ensure bound post-DOM
  els.chime = document.getElementById('chime');
  // Set random tagline
  const tagline = document.querySelector('.tagline');
  if (tagline) {
    tagline.textContent =
      APP_TAGLINES[Math.floor(Math.random() * APP_TAGLINES.length)];
  }

  // 1. Load Typing Time (Must happen before updateSessionStats)
  // We check for the existing date to determine if we continue or reset the time.
  const savedTyping = await storage.get('wt:typingTime', {});
  if (savedTyping.date === appState.typing.date) {
    appState.typing.totalTime = savedTyping.time || 0;
  }

  // 2. Load the rest of the application state
  await loadState();
  await updateSessionStats();

  // Disable DOCX export if the library isn't loaded
  const docxBtn = els.exportMenu?.querySelector('[data-type="docx"]');
  if (docxBtn && !(window.docx && window.docx.Packer)) {
    docxBtn.setAttribute('aria-disabled', 'true');
    docxBtn.title = 'DOCX export unavailable (library not loaded)';
  }
}

document.addEventListener('DOMContentLoaded', init);
