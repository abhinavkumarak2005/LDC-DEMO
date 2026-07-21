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
  
  const [typedText, setTypedText] = useState("");
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS);
  const [result, setResult] = useState<EvalResult | null>(null);
  
  const [wordCount, setWordCount] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [referenceHTML, setReferenceHTML] = useState("Loading exam text...");
  
  const engineRef = useRef<LCSEngine | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const currentPassage = passages.find(p => p.id === selectedPassageId) || passages[0];

  // Initialize engine when starting typing
  useEffect(() => {
    if (appState === 'typing' && !engineRef.current) {
      const newEngine = new LCSEngine(currentPassage.text);
      engineRef.current = newEngine;
      setReferenceHTML(newEngine.buildInitialHTML());
    }
  }, [appState, currentPassage.text]);
  
  // Timer logic
  useEffect(() => {
    let timer: any;
    if (appState === 'typing' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (appState === 'typing' && timeLeft === 0) {
      handleSubmit();
    }
    return () => clearInterval(timer);
  }, [appState, timeLeft]);

  // Maintain focus on text area and auto-scroll reference text
  useEffect(() => {
    if (appState === 'typing') {
      if (textAreaRef.current) {
        textAreaRef.current.focus();
      }
      const container = document.getElementById('reference-text-container');
      if (container) {
        const firstUntyped = container.querySelector('.opacity-50') as HTMLElement;
        if (firstUntyped) {
          container.scrollTo({
            top: firstUntyped.offsetTop - container.offsetTop - container.offsetHeight / 2 + firstUntyped.offsetHeight / 2,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [appState, referenceHTML]);
  
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTypedText(val);

    if (engineRef.current) {
      const evalRes = engineRef.current.evaluate(val, false);
      setReferenceHTML(evalRes.highlightedHTML);
      setWordCount(evalRes.totalTyped);
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
    setTypedText("");
    setTimeLeft(DURATION_SECONDS);
    setResult(null);
    setWordCount(0);
    setWpm(0);
    engineRef.current = null;
    setAppState('selection'); // Send them back to selection to try a new paragraph
  };

  const preventCheat = (e: React.ClipboardEvent | React.MouseEvent | Event) => {
    e.preventDefault();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
  };
  
  const formatTimeStr = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ── INSTRUCTIONS SCREEN ──
  if (appState === 'instructions') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center overflow-y-auto">
        <div className="max-w-4xl w-full space-y-6">
          <div className="flex justify-between items-start mb-8 w-full">
            <img src="/logo.png" alt="Logo Left" className="h-24 w-auto object-contain" />
            <div className="text-center space-y-1 flex-1 px-4">
              <h1 className="text-4xl font-bold text-black pb-2">
                Puducherry Examining Authority
              </h1>
              <h2 className="text-xl font-semibold text-foreground">
                Combined Higher Secondary Level Exam 2025
              </h2>
              <h3 className="text-xl font-semibold text-foreground">
                Typing Speed Test on Computer for the Post of Lower Division Clerk
              </h3>
              <p className="text-xl font-semibold text-foreground">
                Practice questions
              </p>
            </div>
            <img src="/logo.png" alt="Logo Right" className="h-24 w-auto object-contain" />
          </div>

          <Card className="shadow-lg border-2 border-primary/20">
            <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
              <CardTitle className="text-xl text-primary">Qualifying Criteria</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-secondary/50 p-4 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground uppercase tracking-wider font-bold mb-1">Minimum Speed</p>
                  <p className="text-3xl font-bold">35 WPM</p>
                  <p className="text-sm text-muted-foreground mt-1">You must type at least 35 Words Per Minute.</p>
                </div>
                <div className="bg-secondary/50 p-4 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground uppercase tracking-wider font-bold mb-1">Maximum Error Margin</p>
                  <p className="text-3xl font-bold">15%</p>
                  <p className="text-sm text-muted-foreground mt-1">Your total errors cannot exceed 15% of the total words in the passage.</p>
                </div>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-700">Pass / Fail Condition</p>
                  <p className="text-emerald-600/90 text-sm mt-1">
                    To <strong>PASS</strong>, you must achieve <strong>both</strong> conditions: a typing speed of 35 WPM or higher, <strong>AND</strong> an error score within the 15% limit. If either condition is not met, the result will be a <strong>FAIL</strong>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

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
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "the quick fox" <br/><em>Typed:</em> "the fox" (skipped 'quick')</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">2. Addition:</span> Typing an extra word that is not in the original text.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "the fox" <br/><em>Typed:</em> "the fast fox" (added 'fast')</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">3. Substitution:</span> Typing a completely wrong word instead of the correct one.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "the fox" <br/><em>Typed:</em> "the dog"</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">4. Incomplete:</span> Typing a word but leaving it severely truncated.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "government" <br/><em>Typed:</em> "gov"</p>
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
                  <span className="font-bold text-foreground">1. Capitalisation:</span> Typing the correct word but with the wrong case.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "India" <br/><em>Typed:</em> "india"</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">2. Spacing Error:</span> Merging two words together or splitting one word.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "my name" → <em>Typed:</em> "myname"<br/><em>Ref:</em> "have" → <em>Typed:</em> "h ave"</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">3. Transposition:</span> Swapping the order of two adjacent words.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "is very" <br/><em>Typed:</em> "very is"</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">4. Punctuation:</span> Missing, adding, or substituting a punctuation mark.
                  <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "Hello, world" <br/><em>Typed:</em> "Hello world" (missing comma)</p>
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

  // ── SELECTION SCREEN ──
  if (appState === 'selection') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center overflow-y-auto">
        <div className="max-w-4xl w-full space-y-6">
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-4xl font-bold text-primary">Select a Practice Passage</h1>
            <p className="text-muted-foreground text-lg">Choose from the list of passages below to begin your typing test.</p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {passages.map((p) => (
              <Card 
                key={p.id} 
                className="cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => {
                  setSelectedPassageId(p.id);
                  setAppState('typing');
                }}
              >
                <CardContent className="p-6 text-center space-y-2">
                  <h3 className="font-bold text-lg">Paragraph {p.id}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{p.title}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="flex justify-center pt-8">
            <Button className="h-14 px-12 text-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-input" onClick={() => setAppState('instructions')}>
              Back to Instructions
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS SCREEN ──
  if (appState === 'results' && result) {
    const timeUsed = DURATION_SECONDS - timeLeft;
    const finalWpm = engineRef.current ? engineRef.current.getWPM() : 0;
    
    // Determine Pass/Fail based on user rules
    const hasPassed = result.totalErrorScore <= result.errorThreshold && finalWpm >= 35;
    
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col items-center justify-center overflow-y-auto">
        <div className="max-w-5xl w-full space-y-4 my-8">
          
          {/* VERDICT BANNER */}
          <div className={`p-6 rounded-xl border-2 flex flex-col items-center justify-center text-center space-y-2 shadow-sm ${hasPassed ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 border-red-500 text-red-700 dark:text-red-400'}`}>
            <h2 className="text-5xl font-extrabold flex items-center gap-4 tracking-tight">
              {hasPassed ? <CheckCircle2 className="w-12 h-12" /> : <XCircle className="w-12 h-12" />}
              {hasPassed ? "PASSED" : "FAILED"}
            </h2>
            <p className="text-lg font-medium opacity-90">
              {hasPassed 
                ? "Congratulations! You met both the WPM and Error Limit requirements." 
                : "You did not meet the passing criteria. Keep practicing!"}
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card className={finalWpm >= 35 ? "bg-emerald-500/5 border-emerald-500/30" : "bg-red-500/5 border-red-500/30"}>
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                <Zap className="w-6 h-6 mb-1" />
                <p className="text-sm uppercase tracking-wider font-bold">Your WPM</p>
                <p className="text-3xl font-bold">{finalWpm}</p>
                <p className="text-xs opacity-70">Target: 35 WPM</p>
              </CardContent>
            </Card>

            <Card className="bg-secondary/50">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mb-1" />
                <p className="text-sm text-emerald-600 uppercase tracking-wider font-semibold">Correct Words</p>
                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
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
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{result.fullMistakes}</p>
                <p className="text-xs text-muted-foreground">−1 each</p>
              </CardContent>
            </Card>

            <Card className="bg-amber-500/10 border-amber-500/20">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                <AlertTriangle className="w-6 h-6 text-amber-500 mb-1" />
                <p className="text-sm text-amber-500 uppercase tracking-wider font-semibold">Half Mistakes</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{result.halfMistakes}</p>
                <p className="text-xs text-muted-foreground">−0.5 each</p>
              </CardContent>
            </Card>

            <Card className={result.totalErrorScore <= result.errorThreshold ? "bg-emerald-500/5 border-emerald-500/30" : "bg-red-500/5 border-red-500/30"}>
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
                <p className="text-sm uppercase tracking-wider font-bold">Error Score</p>
                <p className="text-3xl font-bold">{result.totalErrorScore.toFixed(1)}</p>
                <p className="text-xs opacity-70">Limit (15%): {result.errorThreshold.toFixed(1)}</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="flex gap-4 justify-center text-sm flex-wrap">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-muted-foreground">Correct</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-muted-foreground">Full mistake</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="text-muted-foreground">Half mistake</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-gray-400 opacity-50"></span>
              <span className="text-muted-foreground">Not typed</span>
            </span>
          </div>
          
          <div className="flex justify-center pb-2">
            <Badge variant="outline" className="text-base px-6 py-1.5 border-amber-500/30 text-amber-600 bg-amber-500/5 flex gap-4">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4"/> Time Used: <span className="font-mono font-bold">{formatTimeStr(timeUsed)}</span>
              </span>
              <span className="opacity-50">•</span>
              <span>Time Left: <span className="font-mono font-bold">{formatTimeStr(timeLeft)}</span></span>
            </Badge>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="shadow-md border-border/50 bg-secondary/30 flex flex-col">
              <CardHeader className="py-3 px-6">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Expected Text (Reference)
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6 px-6 overflow-y-auto max-h-[40vh] custom-scrollbar">
                <div
                  className="text-base leading-relaxed font-medium tracking-wide"
                  dangerouslySetInnerHTML={{ __html: result.highlightedHTML }}
                />
              </CardContent>
            </Card>

            <Card className="shadow-md border-border/50 bg-secondary/30 flex flex-col">
              <CardHeader className="py-3 px-6">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Your Typed Text
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-6 px-6 overflow-y-auto max-h-[40vh] custom-scrollbar">
                <div
                  className="text-base leading-relaxed font-medium tracking-wide"
                  dangerouslySetInnerHTML={{ __html: result.typedHTML || result.highlightedHTML }}
                />
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

  // ── TYPING SCREEN ──
  const isWarningTime = timeLeft < 15;
  const totalWords = engineRef.current?.referenceWords.length || 0;
  
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full flex flex-col space-y-4 my-auto">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Typing Demo - Paragraph {selectedPassageId}</h2>
            <p className="text-muted-foreground mt-1 font-medium">
              Guest User | DEMO
            </p>
          </div>
          <div className={`text-3xl font-mono font-bold px-6 py-2 rounded-lg border-2 shadow-sm ${isWarningTime ? 'text-destructive border-destructive bg-destructive/10 animate-pulse' : 'bg-secondary/50 border-border'}`}>
            {formatTimeStr(timeLeft)}
          </div>
        </div>

        <Card className="shadow-md border-border/50 bg-secondary/30 max-h-[30vh] overflow-hidden flex flex-col relative">
          <CardContent id="reference-text-container" className="p-4 overflow-y-auto custom-scrollbar relative">
            <div 
              className="text-xl leading-relaxed select-none font-medium tracking-wide relative"
              dangerouslySetInnerHTML={{ __html: referenceHTML }}
            />
          </CardContent>
        </Card>

        <textarea
          ref={textAreaRef}
          value={typedText}
          onChange={handleInput}
          onPaste={handlePaste}
          onCopy={preventCheat as any}
          onCut={preventCheat as any}
          className="w-full min-h-[25vh] p-4 bg-background border-2 border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none text-xl leading-relaxed shadow-sm custom-scrollbar"
          placeholder="Begin typing the reference text here..."
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />

        <Card className="bg-secondary/50 border-none shrink-0">
          <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex gap-12 flex-wrap">
              <div className="text-center">
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Words</p>
                <p className="text-2xl font-bold">{wordCount} <span className="text-muted-foreground text-lg font-medium">/ {totalWords}</span></p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">WPM</p>
                <p className="text-2xl font-bold text-primary">{wpm}</p>
              </div>
            </div>
            
            <Button 
              onClick={handleSubmit} 
              className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg"
            >
              SUBMIT EXAM
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
