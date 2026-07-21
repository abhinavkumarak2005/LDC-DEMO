import React, { useState, useEffect, useRef } from 'react';
import { LCSEngine, type EvalResult } from './lib/lcsEngine';
import { passages } from './lib/passages';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { CheckCircle2, AlertCircle, Zap, Clock, AlertTriangle, ChevronRight, XCircle } from 'lucide-react';

const DURATION_SECONDS = 600; // 10 minutes

type AppState = 'instructions' | 'selection' | 'typing' | 'results';

export default function App() {
  const [appState, setAppState] = useState<AppState>('instructions');
  const [selectedPassageId, setSelectedPassageId] = useState<number>(1);

  const [typedText, setTypedText] = useState('');
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS);
  const [result, setResult] = useState<EvalResult | null>(null);

  const [wordCount, setWordCount] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [referenceHTML, setReferenceHTML] = useState('Loading...');

  const engineRef = useRef<LCSEngine | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const currentPassage = passages.find(p => p.id === selectedPassageId) || passages[0];

  // Initialize engine when starting typing
  useEffect(() => {
    if (appState === 'typing' && !engineRef.current) {
      const eng = new LCSEngine(currentPassage.text);
      engineRef.current = eng;
      setReferenceHTML(eng.buildInitialHTML());
    }
  }, [appState, currentPassage.text]);

  // Timer
  useEffect(() => {
    let timer: any;
    if (appState === 'typing' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (appState === 'typing' && timeLeft === 0) {
      handleSubmit();
    }
    return () => clearInterval(timer);
  }, [appState, timeLeft]);

  // Focus + auto-scroll reference text as user types
  useEffect(() => {
    if (appState === 'typing') {
      textAreaRef.current?.focus();
      const container = document.getElementById('ref-container');
      if (container) {
        const firstUntyped = container.querySelector('.opacity-50') as HTMLElement | null;
        if (firstUntyped) {
          container.scrollTo({
            top: firstUntyped.offsetTop - container.offsetTop - container.offsetHeight / 2,
            behavior: 'smooth',
          });
        }
      }
    }
  }, [appState, referenceHTML]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTypedText(val);
    if (engineRef.current) {
      const res = engineRef.current.evaluate(val, false);
      setReferenceHTML(res.highlightedHTML);
      setWordCount(res.totalTyped);
      setWpm(engineRef.current.getWPM());
    }
  };

  const handleSubmit = () => {
    if (!engineRef.current) return;
    const finalResult = engineRef.current.evaluate(typedText, true);
    setResult(finalResult);
    setAppState('results');
  };

  const handlePracticeAgain = () => {
    setTypedText('');
    setTimeLeft(DURATION_SECONDS);
    setResult(null);
    setWordCount(0);
    setWpm(0);
    engineRef.current = null;
    setAppState('selection');
  };

  const fmt = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  // ── INSTRUCTIONS ──────────────────────────────────────────────────────────
  if (appState === 'instructions') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full space-y-6">

          {/* Header with logos */}
          <div className="flex justify-between items-start w-full mb-6">
            <img src="/logo.png" alt="Logo" className="h-24 w-auto object-contain" />
            <div className="text-center space-y-1 flex-1 px-4">
              <h1 className="text-4xl font-bold text-black">Puducherry Examining Authority</h1>
              <h2 className="text-xl font-semibold text-foreground">Combined Higher Secondary Level Exam 2025</h2>
              <h3 className="text-xl font-semibold text-foreground">Typing Speed Test on Computer for the Post of Lower Division Clerk</h3>
              <p className="text-xl font-semibold text-foreground">Practice questions</p>
            </div>
            <img src="/logo.png" alt="Logo" className="h-24 w-auto object-contain" />
          </div>

          {/* Qualifying Criteria — errors only */}
          <Card className="shadow-lg border-2 border-primary/20">
            <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
              <CardTitle className="text-xl text-primary">Qualifying Criteria</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="bg-secondary/50 p-4 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-bold mb-1">Maximum Error Margin</p>
                <p className="text-3xl font-bold">15%</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your total errors must not exceed 15% of the total words in the passage.
                  For a 350-word passage that means a maximum of <strong>53 errors</strong>.
                </p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-700">Pass / Fail Condition</p>
                  <p className="text-emerald-600/90 text-sm mt-1">
                    To <strong>PASS</strong>, your total error score must be <strong>within the 15% limit</strong>.
                    If you exceed this limit, the result will be a <strong>FAIL</strong>.
                    You will be shown your result at the end of each attempt.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error type rules */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-md border-red-500/20">
              <CardHeader className="bg-red-500/5 pb-4 border-b border-red-500/10">
                <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Full Mistakes (Penalty: 1.0)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4 text-sm leading-relaxed">
                <div>
                  <span className="font-bold text-foreground">1. Omission:</span> A word present in the original text is skipped entirely.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "the quick fox" <br /><em>Typed:</em> "the fox" (skipped 'quick')</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">2. Addition:</span> Typing an extra word not in the original text.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "the fox" <br /><em>Typed:</em> "the fast fox" (added 'fast')</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">3. Substitution:</span> Typing a completely wrong word instead of the correct one.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "the fox" <br /><em>Typed:</em> "the dog"</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">4. Incomplete:</span> Typing a word but leaving it severely truncated.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "government" <br /><em>Typed:</em> "gov"</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-amber-500/20">
              <CardHeader className="bg-amber-500/5 pb-4 border-b border-amber-500/10">
                <CardTitle className="text-lg text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Half Mistakes (Penalty: 0.5)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4 text-sm leading-relaxed">
                <div>
                  <span className="font-bold text-foreground">1. Capitalisation:</span> Correct word but wrong case.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "India" <br /><em>Typed:</em> "india"</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">2. Spacing Error:</span> Merging two words or splitting one word.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "my name" → <em>Typed:</em> "myname"<br /><em>Ref:</em> "have" → <em>Typed:</em> "h ave"</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">3. Transposition:</span> Swapping the order of two adjacent words.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "is very" <br /><em>Typed:</em> "very is"</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">4. Punctuation:</span> Missing, adding, or substituting a punctuation mark when the word itself was typed.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "Hello, world" <br /><em>Typed:</em> "Hello world" (missing comma)</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center pt-4 pb-8">
            <Button className="h-14 px-12 text-lg bg-primary hover:bg-primary/90" onClick={() => setAppState('selection')}>
              I Understand the Rules <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── SELECTION ─────────────────────────────────────────────────────────────
  if (appState === 'selection') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-4xl font-bold text-primary">Select a Practice Passage</h1>
            <p className="text-muted-foreground text-lg">Choose a passage below to begin your typing test.</p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {passages.map(p => (
              <Card
                key={p.id}
                className="cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => { setSelectedPassageId(p.id); setAppState('typing'); }}
              >
                <CardContent className="p-6 text-center space-y-2">
                  <h3 className="font-bold text-lg">
                    {p.id === 1 ? '★ Paragraph 1 (Test)' : `Paragraph ${p.id}`}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{p.title}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-center pt-8 pb-8">
            <Button className="h-14 px-12 text-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-input" onClick={() => setAppState('instructions')}>
              Back to Instructions
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────
  if (appState === 'results' && result) {
    const timeUsed = DURATION_SECONDS - timeLeft;
    const finalWpm = engineRef.current?.getWPM() ?? 0;
    // Pass/fail: errors only
    const hasPassed = result.totalErrorScore <= result.errorThreshold;
    const errorPct = result.totalRef > 0
      ? Math.round((result.totalErrorScore / result.totalRef) * 100 * 10) / 10
      : 0;

    return (
      <div className="min-h-screen bg-background p-4 md:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full space-y-4 my-8">

          {/* Verdict banner */}
          <div className={`p-6 rounded-xl border-2 flex flex-col items-center justify-center text-center space-y-2 shadow-sm ${hasPassed ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700' : 'bg-red-500/10 border-red-500 text-red-700'}`}>
            <h2 className="text-5xl font-extrabold flex items-center gap-4 tracking-tight">
              {hasPassed ? <CheckCircle2 className="w-12 h-12" /> : <XCircle className="w-12 h-12" />}
              {hasPassed ? 'PASSED' : 'FAILED'}
            </h2>
            <p className="text-lg font-medium opacity-90">
              {hasPassed
                ? 'Congratulations! Your error score is within the 15% limit.'
                : 'Your error score exceeded the 15% limit. Keep practicing!'}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {/* WPM — informational only, not pass/fail */}
            <Card className="bg-secondary/50">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                <Zap className="w-6 h-6 mb-1 text-primary" />
                <p className="text-sm uppercase tracking-wider font-bold text-muted-foreground">Your WPM</p>
                <p className="text-3xl font-bold">{finalWpm}</p>
              </CardContent>
            </Card>

            <Card className="bg-emerald-500/10 border-emerald-500/20">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mb-1" />
                <p className="text-sm text-emerald-600 uppercase tracking-wider font-semibold">Correct Words</p>
                <p className="text-3xl font-bold text-emerald-700">
                  {result.correctWords}
                  <span className="text-base text-muted-foreground ml-1">/ {result.totalRef}</span>
                </p>
              </CardContent>
            </Card>

            <Card className="bg-secondary/50">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Word Accuracy</p>
                <p className="text-3xl font-bold">{result.wordAccuracy.toFixed(1)}%</p>
              </CardContent>
            </Card>

            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                <AlertCircle className="w-6 h-6 text-red-500 mb-1" />
                <p className="text-sm text-red-500 uppercase tracking-wider font-semibold">Full Mistakes</p>
                <p className="text-3xl font-bold text-red-600">{result.fullMistakes}</p>
                <p className="text-xs text-muted-foreground">−1 each</p>
              </CardContent>
            </Card>

            <Card className="bg-amber-500/10 border-amber-500/20">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                <AlertTriangle className="w-6 h-6 text-amber-500 mb-1" />
                <p className="text-sm text-amber-500 uppercase tracking-wider font-semibold">Half Mistakes</p>
                <p className="text-3xl font-bold text-amber-600">{result.halfMistakes}</p>
                <p className="text-xs text-muted-foreground">−0.5 each</p>
              </CardContent>
            </Card>

            {/* Total Mistakes card — shows % big, number below */}
            <Card className={result.totalErrorScore <= result.errorThreshold ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-red-500/5 border-red-500/30'}>
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-0">
                <p className="text-sm uppercase tracking-wider font-bold">Total Mistakes</p>
                <p className="text-4xl font-extrabold leading-none mt-1">{errorPct}%</p>
                <p className="text-base font-semibold mt-1">{result.totalErrorScore.toFixed(1)} errors</p>
                <p className="text-xs opacity-60 mt-0.5">Limit (15%): {result.errorThreshold}</p>
              </CardContent>
            </Card>
          </div>

          {/* Legend */}
          <div className="flex gap-4 justify-center text-sm flex-wrap">
            {[['bg-emerald-500','Correct'],['bg-red-500','Full mistake'],['bg-amber-500','Half mistake'],['bg-gray-400 opacity-50','Not typed']].map(([cls, lbl]) => (
              <span key={lbl} className="flex items-center gap-1">
                <span className={`inline-block w-3 h-3 rounded-full ${cls}`}></span>
                <span className="text-muted-foreground">{lbl}</span>
              </span>
            ))}
          </div>

          {/* Time badge */}
          <div className="flex justify-center">
            <Badge variant="outline" className="text-base px-6 py-1.5 border-amber-500/30 text-amber-600 bg-amber-500/5 flex gap-4">
              <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Time Used: <span className="font-mono font-bold">{fmt(timeUsed)}</span></span>
              <span className="opacity-50">•</span>
              <span>Time Left: <span className="font-mono font-bold">{fmt(timeLeft)}</span></span>
            </Badge>
          </div>

          {/* Highlighted text panels */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="shadow-md border-border/50 bg-secondary/30 flex flex-col">
              <CardHeader className="py-3 px-6">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Expected Text (Reference)
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6 px-6 overflow-y-auto max-h-[40vh] custom-scrollbar">
                <div className="text-base leading-relaxed font-medium tracking-wide" dangerouslySetInnerHTML={{ __html: result.highlightedHTML }} />
              </CardContent>
            </Card>
            <Card className="shadow-md border-border/50 bg-secondary/30 flex flex-col">
              <CardHeader className="py-3 px-6">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" /> Your Typed Text
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6 px-6 overflow-y-auto max-h-[40vh] custom-scrollbar">
                <div className="text-base leading-relaxed font-medium tracking-wide" dangerouslySetInnerHTML={{ __html: result.typedHTML || result.highlightedHTML }} />
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center pt-4 pb-8">
            <Button onClick={handlePracticeAgain} className="px-12 h-12 text-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              Practice Another Paragraph
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── TYPING ────────────────────────────────────────────────────────────────
  const isWarningTime = timeLeft < 60;
  const totalWords = engineRef.current?.referenceWords.length || 0;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <div className="max-w-6xl mx-auto w-full flex flex-col h-full p-4 md:p-6 gap-3">

        {/* Header */}
        <div className="flex flex-row justify-between items-center gap-4 pb-2 border-b border-border shrink-0">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Typing Demo — Paragraph {selectedPassageId}</h2>
            <p className="text-muted-foreground text-sm font-medium">Guest User | DEMO</p>
          </div>
          <div className={`text-2xl font-mono font-bold px-5 py-2 rounded-lg border-2 shadow-sm shrink-0 ${isWarningTime ? 'text-destructive border-destructive bg-destructive/10 animate-pulse' : 'bg-secondary/50 border-border'}`}>
            {fmt(timeLeft)}
          </div>
        </div>

        {/* Reference panel — 65% of remaining height */}
        <Card className="shadow-md border-border/50 bg-secondary/30 shrink-0" style={{ flex: '6 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <CardContent id="ref-container" className="p-4 overflow-y-auto custom-scrollbar flex-1">
            <div
              className="text-lg leading-relaxed select-none font-medium tracking-wide"
              dangerouslySetInnerHTML={{ __html: referenceHTML }}
            />
          </CardContent>
        </Card>

        {/* Typing area — 25% of remaining height */}
        <textarea
          ref={textAreaRef}
          value={typedText}
          onChange={handleInput}
          style={{ flex: '2.5 1 0', minHeight: 0 }}
          className="w-full p-4 bg-background border-2 border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none text-lg leading-relaxed shadow-sm custom-scrollbar shrink-0"
          placeholder="Begin typing the reference text here..."
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />

        {/* Status bar */}
        <Card className="bg-secondary/50 border-none shrink-0">
          <CardContent className="p-3 flex flex-row justify-between items-center gap-4">
            <div className="flex gap-10 flex-wrap">
              <div className="text-center">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Words</p>
                <p className="text-xl font-bold">{wordCount} <span className="text-muted-foreground text-base font-medium">/ {totalWords}</span></p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">WPM</p>
                <p className="text-xl font-bold text-primary">{wpm}</p>
              </div>
            </div>
            <Button onClick={handleSubmit} className="h-10 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base">
              SUBMIT EXAM
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
