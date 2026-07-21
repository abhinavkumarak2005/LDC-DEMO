/**
 * frontend/src/lib/lcsEngine.ts
 * ─────────────────────────────
 * LCS-based live typing evaluation engine (TypeScript).
 *
 * Mirrors the Python lcs_evaluator.py logic exactly so that the live
 * highlighting during the exam matches the final server-side score.
 *
 * Key design decisions matching the reference Typing.php:
 *  1. Both reference and typed text have '.' and ',' expanded into
 *     standalone tokens BEFORE LCS matching. This means:
 *       "and,"  → ['and', ',']
 *       "and ," → ['and', ',']        (same tokens — no error)
 *       "and"   → ['and']             (missing comma → half mistake)
 *  2. Commas and periods are NEVER counted as correct/wrong words —
 *     only as punctuation half-mistakes when missing/extra.
 *  3. HTML is assembled with smart joining: no space is inserted before
 *     '.' or ',' tokens so "and ," never appears — it reads "and,".
 *  4. Matched punct tokens render as green (correct).
 *     Missing punct tokens render as amber (half mistake) inline.
 *     Not-yet-typed punct tokens render as grey (not typed).
 *
 * Error classification (Government of Puducherry — Annexure-II):
 *
 *  Full Mistakes  (penalty 1.0, shown in RED):
 *    - omission      : word in reference but not typed
 *    - addition      : extra word typed not in reference
 *    - substitution  : wrong word typed
 *    - incomplete    : word truncated < 60% of ref length
 *
 *  Half Mistakes  (penalty 0.5, shown in AMBER):
 *    - capitalisation : same word, only case differs
 *    - spacing_merged : two ref words joined (e.g. 'myname')
 *    - spacing_split  : one ref word split (e.g. 'h ave')
 *    - transposition  : two adjacent words swapped
 *    - punctuation    : punctuation omitted/added/substituted
 *
 *  Not Typed  (shown in DIM GREY):
 *    - reference tokens beyond what the candidate has typed yet
 */

const PUNCT_TOKENS = new Set(['.', ',']);

export type TokenStatus =
  | 'correct'
  | 'full_error'
  | 'half_error'
  | 'not_typed';

export interface DiffToken {
  ref: string;
  typed: string | null;
  status: TokenStatus;
  errorType: string | null;
}

export interface EvalResult {
  /** Colored HTML string for the reference text display */
  highlightedHTML: string;
  /** Colored HTML string for the typed text display */
  typedHTML: string;
  /** Per-word token results aligned to reference */
  diffTokens: DiffToken[];
  correctWords: number;
  fullMistakes: number;
  halfMistakes: number;
  totalErrorScore: number;
  errorThreshold: number;
  totalTyped: number;
  totalRef: number;
  wordAccuracy: number;
  charAccuracy: number;
  correctChars: number;
  totalCharsTyped: number;
  /** Legacy compat */
  wrongWords: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-processing (mirrors Typing.php lines 22-32)
// ─────────────────────────────────────────────────────────────────────────────

function preprocess(text: string): string[] {
  // Expand . and , into standalone tokens so "and," ≡ "and ,"
  let t = text.replace(/\./g, ' . ').replace(/,/g, ' , ');
  t = t.replace(/\s+/g, ' ').trim();
  return t.split(' ').filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// LCS DP matrix
// ─────────────────────────────────────────────────────────────────────────────

function buildLCSMatrix(a: string[], b: string[]): number[][] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backtrack
// ─────────────────────────────────────────────────────────────────────────────

interface RawDiff {
  ref: string | null;
  typed: string | null;
  status: 'match' | 'delete' | 'insert' | 'transposition_half';
}

function backtrack(dp: number[][], a: string[], b: string[]): RawDiff[] {
  const diff: RawDiff[] = [];
  let i = a.length, j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1].toLowerCase() === b[j - 1].toLowerCase() && dp[i][j] > dp[i - 1][j]) {
      // Only match if it strictly increases the LCS from the previous row.
      // This forces the algorithm to match the EARLIEST occurrence of a word in the reference text,
      // which is critical for paragraphs that contain repeating sentences.
      diff.push({ ref: a[i - 1], typed: b[j - 1], status: 'match' });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.push({ ref: null, typed: b[j - 1], status: 'insert' });
      j--;
    } else {
      diff.push({ ref: a[i - 1], typed: null, status: 'delete' });
      i--;
    }
  }

  return diff.reverse();
}

// ─────────────────────────────────────────────────────────────────────────────
// Error block classification
// ─────────────────────────────────────────────────────────────────────────────

interface ErrorItem {
  errorType: string;
  ref?: string | null;
  typed?: string | null;
  penalty: number;
  nHalf?: number;   // explicit half-mistake count for merged/split/transposition
}

function classifyErrorBlock(delWords: string[], insWords: string[]): ErrorItem[] {
  const errors: ErrorItem[] = [];

  // Spacing merged: 'myname' for 'my' 'name'
  if (insWords.length === 1 && delWords.length >= 2) {
    if (delWords.join('').toLowerCase() === insWords[0].toLowerCase()) {
      const nMissing = delWords.length - 1; // each removed space = 0.5
      return [{ errorType: 'spacing_merged', ref: delWords.join(' '), typed: insWords[0], penalty: nMissing * 0.5, nHalf: nMissing }];
    }
  }

  // Spacing split: 'h ave' for 'have'
  if (delWords.length === 1 && insWords.length >= 2) {
    if (delWords[0].toLowerCase() === insWords.join('').toLowerCase()) {
      const nExtra = insWords.length - 1;
      return [{ errorType: 'spacing_split', ref: delWords[0], typed: insWords.join(' '), penalty: nExtra * 0.5, nHalf: nExtra }];
    }
  }

  // Transposition — check if the block is purely a permutation of the same words
  if (delWords.length === insWords.length && delWords.length >= 2) {
    const delSorted = [...delWords].map(w => w.toLowerCase()).sort();
    const insSorted = [...insWords].map(w => w.toLowerCase()).sort();
    const isPurePermutation = delSorted.every((w, i) => w === insSorted[i]);

    if (isPurePermutation) {
      // Count adjacent transposed pairs for half-mistake scoring
      let transposedPairs = 0;
      const used = new Set<number>();
      for (let k = 0; k < delWords.length - 1; k++) {
        if (used.has(k) || used.has(k + 1)) continue;
        if (delWords[k].toLowerCase() === insWords[k + 1].toLowerCase() &&
            delWords[k + 1].toLowerCase() === insWords[k].toLowerCase()) {
          transposedPairs++;
          used.add(k);
          used.add(k + 1);
        }
      }
      // Each unique out-of-place pair = 1 half mistake, minimum 1
      const nHalf = Math.max(transposedPairs, 1);
      return [{ errorType: 'transposition', ref: delWords.join(' '), typed: insWords.join(' '), penalty: nHalf * 0.5, nHalf }];
    }
    // Partial transpositions fall through to word-by-word
  }

  // Word-by-word
  const n = Math.max(delWords.length, insWords.length);
  for (let k = 0; k < n; k++) {
    const r = k < delWords.length ? delWords[k] : null;
    const t = k < insWords.length ? insWords[k] : null;

    if (!r) {
      errors.push({ errorType: 'addition', ref: null, typed: t, penalty: 1.0 });
    } else if (!t) {
      errors.push({ errorType: 'omission', ref: r, typed: null, penalty: 1.0 });
    } else if (r.toLowerCase() === t.toLowerCase()) {
      // Case-insensitive match inside an error block — capitalisation
      // (This can fire when the LCS doesn't match them due to surrounding errors)
      errors.push({ errorType: 'capitalisation', ref: r, typed: t, penalty: 0.5 });
    } else if (
      r.replace(/[^\w]/g, '').toLowerCase() === t.replace(/[^\w]/g, '').toLowerCase() &&
      r.replace(/[^\w]/g, '').length > 0
    ) {
      errors.push({ errorType: 'punctuation', ref: r, typed: t, penalty: 0.5 });
    } else if (t.length < r.length * 0.6 && r.toLowerCase().startsWith(t.toLowerCase()) && t.length >= 2) {
      errors.push({ errorType: 'incomplete', ref: r, typed: t, penalty: 1.0 });
    } else {
      errors.push({ errorType: 'substitution', ref: r, typed: t, penalty: 1.0 });
    }
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML escaping
// ─────────────────────────────────────────────────────────────────────────────

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Span builders
// ─────────────────────────────────────────────────────────────────────────────

function correctSpan(word: string): string {
  return `<span class="text-emerald-600 dark:text-emerald-400 font-medium">${escapeHTML(word)}</span>`;
}
function fullErrorSpan(word: string, typed: string | null): string {
  const title = typed ? ` title="Typed: ${escapeHTML(typed)}"` : ' title="Omitted"';
  return `<span class="text-red-500 dark:text-red-400 font-medium underline decoration-red-400 underline-offset-2"${title}>${escapeHTML(word)}</span>`;
}
function halfErrorSpan(word: string, typed: string | null, errType: string): string {
  const label = typed ? `Typed: ${escapeHTML(typed)} (${errType})` : errType;
  return `<span class="text-amber-500 dark:text-amber-400 font-medium underline decoration-amber-400 underline-offset-2 decoration-dashed" title="${label}">${escapeHTML(word)}</span>`;
}
function notTypedSpan(word: string): string {
  return `<span class="text-muted-foreground/40">${escapeHTML(word)}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart HTML builder
//
// Joins (token, html) pairs so that '.' and ',' are NEVER preceded by a space.
// e.g. ['and', ',', 'also'] → "and, also" not "and , also"
// ─────────────────────────────────────────────────────────────────────────────

interface HtmlPart {
  token: string;   // the reference token this span represents
  html: string;
}

function buildHTML(parts: HtmlPart[]): string {
  let result = '';
  for (let i = 0; i < parts.length; i++) {
    const isPunct = PUNCT_TOKENS.has(parts[i].token);
    if (i === 0 || isPunct) {
      // No space before first token or before any punctuation
      result += parts[i].html;
    } else {
      result += ' ' + parts[i].html;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main engine class
// ─────────────────────────────────────────────────────────────────────────────

export class LCSEngine {
  referenceText: string;
  referenceTokens: string[];
  referenceWords: string[];   // tokens excluding '.' and ','
  referenceCharCount: number;
  startTime: number | null;
  lastEvalResult: EvalResult | null;

  constructor(referenceText: string) {
    this.referenceText = referenceText;
    this.referenceTokens = preprocess(referenceText);
    this.referenceWords = this.referenceTokens.filter(t => !PUNCT_TOKENS.has(t));
    this.referenceCharCount = referenceText.length;
    this.startTime = null;
    this.lastEvalResult = null;
  }

  /**
   * Build the initial "not typed yet" HTML for the reference panel.
   * Uses the full token list (including punct) with smart joining so
   * "and," shows as "and," not "and ," in the grey placeholder.
   */
  buildInitialHTML(): string {
    const parts: HtmlPart[] = this.referenceTokens.map(token => ({
      token,
      html: notTypedSpan(token),
    }));
    return buildHTML(parts);
  }

  /**
   * @param typedText  The candidate's typed text
   * @param isFinal    Pass true when evaluating a completed/submitted exam.
   *                   Treats ALL omissions (including trailing punct like a
   *                   final period) as errors — no "not typed yet" grace.
   *                   Pass false (default) for live typing display where
   *                   untyped words ahead of cursor are shown grey.
   */
  evaluate(typedText: string, isFinal = false): EvalResult {
    if (this.startTime === null && typedText.length > 0) {
      this.startTime = Date.now();
    }

    const typedTokens = preprocess(typedText);
    const typedWords = typedTokens.filter(t => !PUNCT_TOKENS.has(t));
    const nTypedWords = typedWords.length;

    // ── LCS on full token lists with anchor (mirrors Typing.php " - " prefix) ─
    const refA = ['-', ...this.referenceTokens];
    const typedA = ['-', ...typedTokens];

    const dp = buildLCSMatrix(refA, typedA);
    let diff = backtrack(dp, refA, typedA);

    // Drop the anchor match
    if (diff.length > 0 && diff[0].status === 'match' && diff[0].ref === '-') {
      diff = diff.slice(1);
    }

    // ── Post-process diff: fix transpositions broken by LCS ─────────────────
    let idx = 0;
    while (idx < diff.length) {
      if (diff[idx].status === 'delete' && !PUNCT_TOKENS.has(diff[idx].ref!)) {
        for (let j = idx + 1; j < Math.min(idx + 8, diff.length); j++) {
          if (diff[j].status === 'insert' && diff[j].typed?.toLowerCase() === diff[idx].ref?.toLowerCase()) {
            diff[idx].status = 'transposition_half';
            diff[idx].typed = diff[j].typed;
            diff.splice(j, 1);
            break;
          }
        }
      } else if (diff[idx].status === 'insert' && !PUNCT_TOKENS.has(diff[idx].typed!)) {
        for (let j = idx + 1; j < Math.min(idx + 8, diff.length); j++) {
          if (diff[j].status === 'delete' && diff[j].ref?.toLowerCase() === diff[idx].typed?.toLowerCase()) {
            diff[j].status = 'transposition_half';
            diff[j].typed = diff[idx].typed;
            diff.splice(idx, 1);
            idx--;
            break;
          }
        }
      }
      idx++;
    }

    // ── Find the "typed horizon" ────────────────────────────────────────────
    // Everything after the last non-delete item is "not typed yet".
    let lastNonDeleteIdx = -1;
    for (let i = diff.length - 1; i >= 0; i--) {
      if (diff[i].status !== 'delete') { lastNonDeleteIdx = i; break; }
    }

    // ── Process diff ───────────────────────────────────────────────────────
    let fullMistakes = 0;
    let halfMistakes = 0;
    let correctWords = 0;
    const diffTokens: DiffToken[] = [];
    const htmlParts: HtmlPart[] = [];   // replaces the old spans[] array
    const typedHtmlParts: HtmlPart[] = []; // NEW: for rendering exactly what they typed

    let i = 0;
    let refWordIdx = -1;
    let typedWordIdx = -1;

    while (i < diff.length) {
      const item = diff[i];

      // ── MATCH ──────────────────────────────────────────────────────────────
      if (item.status === 'match') {
        const isPunct = PUNCT_TOKENS.has(item.ref!);
        if (isPunct) {
          // Matched punctuation: always correct, render green
          htmlParts.push({ token: item.ref!, html: correctSpan(item.ref!) });
          typedHtmlParts.push({ token: item.typed!, html: correctSpan(item.typed!) });
          diffTokens.push({ ref: item.ref!, typed: item.typed, status: 'correct', errorType: null });
        } else {
          if (item.ref === item.typed) {
            // Exact case match — fully correct
            correctWords++;
            diffTokens.push({ ref: item.ref!, typed: item.typed, status: 'correct', errorType: null });
            htmlParts.push({ token: item.ref!, html: correctSpan(item.ref!) });
            typedHtmlParts.push({ token: item.typed!, html: correctSpan(item.typed!) });
          } else {
          // Case-insensitive match but DIFFERENT case — capitalisation error
          const nCase = [...item.ref!].filter((rc, idx) => rc !== (item.typed ?? '')[idx]).length;
          if (nCase >= 2) {
            // Two or more wrong-case chars = full error
            fullMistakes++;
            diffTokens.push({ ref: item.ref!, typed: item.typed, status: 'full_error', errorType: 'capitalisation' });
            htmlParts.push({ token: item.ref!, html: fullErrorSpan(item.ref!, item.typed ?? null) });
            typedHtmlParts.push({ token: item.typed!, html: fullErrorSpan(item.typed!, null) });
          } else {
            // One wrong-case char = half error
            halfMistakes += 1;
            correctWords++;
            diffTokens.push({ ref: item.ref!, typed: item.typed, status: 'half_error', errorType: 'capitalisation' });
            htmlParts.push({ token: item.ref!, html: halfErrorSpan(item.ref!, item.typed ?? null, 'capitalisation') });
            typedHtmlParts.push({ token: item.typed!, html: halfErrorSpan(item.typed!, null, 'capitalisation') });
          }
        }
      }
      i++;
      continue;
    }

      // ── TRANSPOSITION HALF MATCH ──────────────────────────────────────────
      if (item.status === 'transposition_half' as any) {
        // Transpositions are 0.5 penalty TOTAL for the pair. We'll add 1 to count per word.
        halfMistakes += 1; 
        correctWords++;
        diffTokens.push({ ref: item.ref!, typed: item.typed, status: 'half_error', errorType: 'transposition' });
        htmlParts.push({ token: item.ref!, html: halfErrorSpan(item.ref!, item.typed ?? null, 'transposition') });
        typedHtmlParts.push({ token: item.typed!, html: halfErrorSpan(item.typed!, null, 'transposition') });
        i++;
        continue;
      }

      // ── TRAILING DELETION — "not typed yet" (live mode only) ────────────────
      // In final mode every omission is an error, including a trailing period.
      if (!isFinal && i > lastNonDeleteIdx && item.status === 'delete') {
        // Both word and punct tokens beyond the typed horizon show as grey
        if (!PUNCT_TOKENS.has(item.ref!)) {
          diffTokens.push({ ref: item.ref!, typed: null, status: 'not_typed', errorType: null });
        }
        htmlParts.push({ token: item.ref!, html: notTypedSpan(item.ref!) });
        i++;
        continue;
      }

      // ── In FINAL mode: trailing deletions fall through to error-block below ──
      // ── ERROR BLOCK — collect contiguous del/ins ───────────────────────────
      const delBlock: any[] = [];
      const insBlock: any[] = [];
      let j = i;
      while (j < diff.length && diff[j].status !== 'match') {
        if (diff[j].status === 'delete') delBlock.push(diff[j]);
        else insBlock.push(diff[j]);
        j++;
      }

      const isTrailing = (j === diff.length && insBlock.length === 0);

      // Separate punctuation from real words in this block
      const delPunct = delBlock.filter(d => PUNCT_TOKENS.has(d.ref!)).map(d => d.ref!);
      const insPunct = insBlock.filter(d => PUNCT_TOKENS.has(d.typed!)).map(d => d.typed!);
      
      const delWordsBInfo: {word: string, idx: number}[] = [];
      for (const d of delBlock) {
        if (!PUNCT_TOKENS.has(d.ref!)) {
          refWordIdx++;
          delWordsBInfo.push({ word: d.ref!, idx: refWordIdx });
        }
      }

      const insWordsBInfo: {word: string, idx: number}[] = [];
      for (const d of insBlock) {
        if (!PUNCT_TOKENS.has(d.typed!)) {
          typedWordIdx++;
          insWordsBInfo.push({ word: d.typed!, idx: typedWordIdx });
        }
      }

      // ── Word-level errors ────────────────────────────────────────────────
      const normalDel: string[] = [];
      for (const info of delWordsBInfo) {
        normalDel.push(info.word);
      }

      const normalIns: string[] = [];
      for (const info of insWordsBInfo) {
        normalIns.push(info.word);
      }

      // ── Punctuation-only differences → half mistakes ─────────────────────
      // Punctuation is only a half-error when the WORD itself was correctly matched
      // (i.e., the block has NO deleted words — it is a pure punctuation difference).
      // If ANY reference words were deleted (omitted/substituted), their punctuation
      // errors are absorbed into the word-level full/half errors — never counted separately.
      if (!isTrailing && normalDel.length === 0) {
        const nPairs = Math.min(delPunct.length, insPunct.length);
        const nSubst = Array.from({ length: nPairs }, (_, k) => (delPunct[k] !== insPunct[k] ? 1 : 0) as number)
          .reduce((a: number, b: number) => a + b, 0);
        const nNet = Math.abs(delPunct.length - insPunct.length);
        halfMistakes += (nSubst + nNet);
      }

      let errors: any[] = [];
      let errType = 'substitution';
      if (normalDel.length > 0 || normalIns.length > 0) {
        errors = classifyErrorBlock(normalDel, normalIns);
        const mainError = errors[0];
        errType = mainError?.errorType ?? 'substitution';

        for (const err of errors) {
          if (err.nHalf !== undefined) {
            halfMistakes += err.nHalf;   // explicit half mistake count
          } else if (err.penalty >= 1.0) {
            fullMistakes++;
          } else {
            halfMistakes += 1;
          }
        }
        
        if (errType === 'spacing_merged' || errType === 'spacing_split' || errType === 'transposition') {
          correctWords += normalDel.length;
        }
      }

      // ── Build HTML parts in EXACT reference order ───────────────────────
      for (let k = i; k < j; k++) {
        if (diff[k].status === 'delete') {
          const refToken = diff[k].ref!;
          if (PUNCT_TOKENS.has(refToken)) {
            // Punctuation half-error only when no words were deleted in this block
            // (pure punctuation difference after a matched word).
            if (!isTrailing && normalDel.length === 0) {
              htmlParts.push({ token: refToken, html: halfErrorSpan(refToken, null, 'punctuation') });
              diffTokens.push({ ref: refToken, typed: null, status: 'half_error', errorType: 'punctuation' });
            } else {
              htmlParts.push({ token: refToken, html: notTypedSpan(refToken) });
              diffTokens.push({ ref: refToken, typed: null, status: 'not_typed', errorType: null });
            }
          } else {
            // Word
            if (['spacing_merged', 'spacing_split', 'transposition'].includes(errType)) {
              htmlParts.push({ token: refToken, html: halfErrorSpan(refToken, errors[0]?.typed ?? null, errType) });
              diffTokens.push({ ref: refToken, typed: errors[0]?.typed ?? null, status: 'half_error', errorType: errType });
            } else {
              const err = errors.find(e => e.ref === refToken);
              if (err) {
                const tokStatus: TokenStatus = err.penalty >= 1.0 ? 'full_error' : 'half_error';
                htmlParts.push({
                  token: refToken,
                  html: err.penalty >= 1.0 ? fullErrorSpan(refToken, err.typed ?? null) : halfErrorSpan(refToken, err.typed ?? null, err.errorType),
                });
                diffTokens.push({ ref: refToken, typed: err.typed ?? null, status: tokStatus, errorType: err.errorType });
              }
            }
          }
        }
      }

      // Build typedHtmlParts for this block (exactly what they typed)
      for (const ins of insBlock) {
        if (PUNCT_TOKENS.has(ins.typed!)) {
          typedHtmlParts.push({ token: ins.typed!, html: halfErrorSpan(ins.typed!, null, 'punctuation') });
        } else {
          let pushed = false;
          if (normalDel.length > 0 || normalIns.length > 0) {
            const errType = errors[0]?.errorType ?? 'substitution';
            if (['spacing_merged', 'spacing_split', 'transposition'].includes(errType)) {
              typedHtmlParts.push({ token: ins.typed!, html: halfErrorSpan(ins.typed!, null, errType) });
              pushed = true;
            } else {
              const wordErr = errors.find(e => e.typed === ins.typed);
              if (wordErr) {
                if (wordErr.penalty >= 1.0) typedHtmlParts.push({ token: ins.typed!, html: fullErrorSpan(ins.typed!, null) });
                else typedHtmlParts.push({ token: ins.typed!, html: halfErrorSpan(ins.typed!, null, wordErr.errorType ?? 'error') });
                pushed = true;
              }
            }
          }
          if (!pushed) {
            typedHtmlParts.push({ token: ins.typed!, html: fullErrorSpan(ins.typed!, null) });
          }
        }
      }

      i = j;
    }

    // ── Scoring ────────────────────────────────────────────────────────────
    const totalRef = this.referenceWords.length;
    const totalErrorScore = Math.round((fullMistakes + (halfMistakes * 0.5)) * 10) / 10;
    const errorThreshold = 0.15 * totalRef;
    const wordAccuracy = totalRef > 0 ? Math.round(correctWords / totalRef * 1000) / 10 : 0;

    // Char accuracy (character-level, for legacy compat)
    const refStr = this.referenceText;
    const typedStr = typedText;
    let correctChars = 0;
    const compareLen = Math.min(typedStr.length, refStr.length);
    for (let ci = 0; ci < compareLen; ci++) {
      if (typedStr[ci] === refStr[ci]) correctChars++;
    }
    const charAccuracy = refStr.length > 0
      ? Math.round(correctChars / refStr.length * 1000) / 10
      : 0;

    const result: EvalResult = {
      highlightedHTML: buildHTML(htmlParts),   // expected text highlighted
      typedHTML: buildHTML(typedHtmlParts),    // actually typed text highlighted
      diffTokens,
      correctWords,
      fullMistakes,
      halfMistakes,
      totalErrorScore,
      errorThreshold,
      totalTyped: nTypedWords,
      totalRef,
      wordAccuracy,
      charAccuracy,
      correctChars,
      totalCharsTyped: typedText.length,
      wrongWords: fullMistakes,
    };

    this.lastEvalResult = result;
    return result;
  }

  getWPM(): number {
    if (this.startTime === null || !this.lastEvalResult) return 0;
    const elapsedMinutes = (Date.now() - this.startTime) / 60000;
    if (elapsedMinutes < 0.01) return 0;
    return Math.round(this.lastEvalResult.correctWords / elapsedMinutes);
  }

  getElapsedSeconds(): number {
    if (this.startTime === null) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  reset(): void {
    this.startTime = null;
    this.lastEvalResult = null;
  }
}
