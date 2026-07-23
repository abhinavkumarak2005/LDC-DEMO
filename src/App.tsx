import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { LCSEngine, type EvalResult } from './lib/lcsEngine';
import { passages } from './lib/passages';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { CheckCircle2, AlertCircle, Zap, AlertTriangle, ChevronRight, XCircle, Target } from 'lucide-react';

const DURATION_SECONDS = 600; // 10 minutes

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

function AppRoutes() {
  const [selectedPassageId, setSelectedPassageId] = useState<number>(1);
  const [typedText, setTypedText] = useState('');
  const [timeLeft, setTimeLeft] = useState(DURATION_SECONDS);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [wpm, setWpm] = useState(0);

  const engineRef = useRef<LCSEngine | null>(null);

  const resetPractice = () => {
    setTypedText('');
    setTimeLeft(DURATION_SECONDS);
    setResult(null);
    setWordCount(0);
    setWpm(0);
    engineRef.current = null;
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/instructions" replace />} />
      <Route path="/instructions" element={<InstructionsPage />} />
      <Route path="/selection" element={
        <SelectionPage onSelect={(id) => { setSelectedPassageId(id); resetPractice(); }} />
      } />
      <Route path="/typing" element={
        <TypingPage 
          selectedPassageId={selectedPassageId}
          typedText={typedText}
          setTypedText={setTypedText}
          timeLeft={timeLeft}
          setTimeLeft={setTimeLeft}
          wordCount={wordCount}
          setWordCount={setWordCount}
          wpm={wpm}
          setWpm={setWpm}
          engineRef={engineRef}
          setResult={setResult}
        />
      } />
      <Route path="/results" element={
        <ResultsPage 
          result={result}
          finalWpm={engineRef.current?.getWPM() ?? 0}
          onPracticeAgain={resetPractice}
        />
      } />
    </Routes>
  );
}

function InstructionsPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <div className="flex flex-col items-center text-center space-y-2 mb-6">
          <img src="/logo.png" alt="Logo" className="h-24 w-auto object-contain mb-2" />
          <h1 className="text-4xl font-bold text-black">Government of Puducherry</h1>
          <h1 className="text-4xl font-bold text-black">Puducherry Examining Authority</h1>
          <h2 className="text-xl font-semibold text-foreground">Combined Higher Secondary Level Exam 2025</h2>
          <h3 className="text-xl font-semibold text-foreground">Typing Speed Test on Computer for the Post of Lower Division Clerk</h3>
          <p className="text-xl font-semibold text-foreground">Practice questions</p>
        </div>

        <Card className="shadow-lg border-2 border-primary/20">
          <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
            <CardTitle className="text-xl text-primary">Qualifying Criteria</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-[12pt]">
            <div className="bg-secondary/50 p-4 rounded-lg border border-border">
              <p className="text-[12pt] text-muted-foreground uppercase tracking-wider font-bold mb-1">Maximum Percentage of Mistakes</p>
              <p className="text-3xl font-bold">15%</p>
              <p className="text-[12pt] text-muted-foreground mt-1">
                Your total mistakes must not exceed 15% of the total words in the passage.
                For a 350-word passage that means a maximum of <strong>52.5 mistakes</strong>.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="shadow-md border-red-500/20">
            <CardHeader className="bg-red-500/5 py-3 px-6 border-b border-red-500/10">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-bold text-red-600 text-base leading-tight">Full Mistakes</p>
                  <p className="text-xs text-red-500 font-normal">Penalty: 1 per mistake</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-[12pt] leading-relaxed">
              <div>
                <span className="font-bold text-foreground">1. Omission:</span> A word is skipped entirely.
                <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "the quick fox"<br /><em>Typed:</em> "the fox"</p>
              </div>
              <div>
                <span className="font-bold text-foreground">2. Addition:</span> An extra word is typed.
                <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "the fox"<br /><em>Typed:</em> "the fast fox"</p>
              </div>
              <div>
                <span className="font-bold text-foreground">3. Substitution:</span> A completely wrong word is typed.
                <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "the fox"<br /><em>Typed:</em> "the dog"</p>
              </div>
              <div>
                <span className="font-bold text-foreground">4. Incomplete:</span> A word is severely truncated.
                <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "government"<br /><em>Typed:</em> "gov"</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-amber-500/20">
            <CardHeader className="bg-amber-500/5 py-3 px-6 border-b border-amber-500/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-bold text-amber-600 text-base leading-tight">Half Mistakes</p>
                  <p className="text-xs text-amber-500 font-normal">Penalty: 0.5 per mistake</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-[12pt] leading-relaxed">
              <div>
                <span className="font-bold text-foreground">1. Capitalisation:</span> Correct word, wrong case.
                <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "India"<br /><em>Typed:</em> "india"</p>
              </div>
              <div>
                <span className="font-bold text-foreground">2. Spacing Error:</span> Two words merged or one split.
                <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "my name"<br /><em>Typed:</em> "myname"</p>
              </div>
              <div>
                <span className="font-bold text-foreground">3. Transposition:</span> Two adjacent words swapped.
                <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "is very"<br /><em>Typed:</em> "very is"</p>
              </div>
              <div>
                <span className="font-bold text-foreground">4. Punctuation:</span> A punctuation mark is missing or wrong when the word itself was typed.
                <p className="text-muted-foreground mt-1 bg-secondary/50 p-2 rounded"><em>Ref:</em> "Hello, world"<br /><em>Typed:</em> "Hello world"</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-purple-500/20">
            <CardHeader className="bg-purple-500/5 py-3 px-6 border-b border-purple-500/10">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 shrink-0 text-purple-600" />
                <div>
                  <p className="font-bold text-purple-600 text-base leading-tight">Exceptional Case</p>
                  <p className="text-xs text-purple-500 font-normal">Penalty: 3 per occurrence</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-3 text-[12pt] leading-relaxed">
              <div>
                <span className="font-bold text-foreground">Middle Word Omission with Merge:</span>
                <span className="text-muted-foreground"> When a middle word is deleted and the surrounding words merge together.</span>
              </div>
              <div className="bg-secondary/50 p-3 rounded text-muted-foreground space-y-1">
                <div><em>Ref:</em> &ldquo;my name is&rdquo;</div>
                <div><em>Typed:</em> &ldquo;myis&rdquo;</div>
                <div className="pt-1 border-t border-border/50 mt-1">
                  <div>— Omit &ldquo;name&rdquo; &nbsp;= 1 mistake</div>
                  <div>— &ldquo;myis&rdquo; ≠ &ldquo;my&rdquo; &nbsp;= 1 mistake</div>
                  <div>— &ldquo;myis&rdquo; ≠ &ldquo;is&rdquo; &nbsp;&nbsp;= 1 mistake</div>
                </div>
                <div className="pt-1"><strong>Total = 3 mistakes</strong></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center pt-4 pb-8">
          <Button className="h-14 px-12 text-lg bg-primary hover:bg-primary/90" onClick={() => navigate('/selection')}>
            I Understand the Rules <ChevronRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SelectionPage({ onSelect }: { onSelect: (id: number) => void }) {
  const navigate = useNavigate();
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
              onClick={() => { onSelect(p.id); navigate('/typing'); }}
            >
              <CardContent className="p-6 text-center space-y-2">
                <h3 className="font-bold text-lg">Paragraph {p.id}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{p.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex justify-center pt-8 pb-8">
          <Button className="h-14 px-12 text-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-input" onClick={() => navigate('/instructions')}>
            Back to Instructions
          </Button>
        </div>
      </div>
    </div>
  );
}

function TypingPage({
  selectedPassageId, typedText, setTypedText, timeLeft, setTimeLeft,
  wordCount, setWordCount, wpm, setWpm, engineRef, setResult
}: any) {
  const navigate = useNavigate();
  const currentPassage = passages.find(p => p.id === selectedPassageId) || passages[0];
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const refContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new LCSEngine(currentPassage.text);
    }
  }, [currentPassage.text, engineRef]);

  useEffect(() => {
    let timer: any;
    if (timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev: number) => prev - 1), 1000);
    } else if (timeLeft === 0) {
      handleSubmit();
    }
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (refContainerRef.current && engineRef.current) {
      const container = refContainerRef.current;
      const totalWords = engineRef.current.referenceWords.length || 1;
      const ratio = wordCount / totalWords;
      const maxScroll = container.scrollHeight - container.clientHeight;
      const targetScroll = ratio * maxScroll;
      
      const offset = ratio > 0.8 ? 60 * (1 - ratio) / 0.2 : 60;
      container.scrollTo({ top: Math.max(0, targetScroll - offset), behavior: 'smooth' });
    }
  }, [wordCount, engineRef]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTypedText(val);
    if (engineRef.current) {
      const res = engineRef.current.evaluate(val, false);
      setWordCount(res.totalTyped);
      setWpm(engineRef.current.getWPM());
    }
  };

  const handleSubmit = () => {
    if (!engineRef.current) return;
    const finalResult = engineRef.current.evaluate(typedText, true);
    setResult(finalResult);
    navigate('/results');
  };

  const fmt = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const isWarningTime = timeLeft < 60;
  const totalW = engineRef.current?.referenceWords.length || 0;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <div className="max-w-6xl mx-auto w-full flex flex-col h-full p-4 md:p-6 gap-3">
        <div className="flex flex-row justify-between items-center gap-4 pb-2 border-b border-border shrink-0">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Typing Demo — Paragraph {selectedPassageId}</h2>
            <p className="text-muted-foreground text-sm font-medium">Guest User | DEMO</p>
          </div>
          <div className={`text-2xl font-mono font-bold px-5 py-2 rounded-lg border-2 shadow-sm shrink-0 ${isWarningTime ? 'text-destructive border-destructive bg-destructive/10 animate-pulse' : 'bg-secondary/50 border-border'}`}>
            {fmt(timeLeft)}
          </div>
        </div>

        <Card className="shadow-md border-border/50 bg-secondary/30 shrink-0" style={{ flex: '6 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <CardContent className="p-4 overflow-y-auto custom-scrollbar flex-1" ref={refContainerRef}>
            <p className="text-[12pt] leading-relaxed select-none font-medium tracking-wide text-foreground whitespace-pre-wrap">
              {currentPassage.text}
            </p>
          </CardContent>
        </Card>

        <textarea
          ref={textAreaRef}
          value={typedText}
          onChange={handleInput}
          style={{ flex: '2.5 1 0', minHeight: 0 }}
          className="w-full p-4 bg-background border-2 border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none text-[12pt] leading-relaxed shadow-sm custom-scrollbar shrink-0"
          placeholder="Begin typing the reference text here..."
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />

        <Card className="bg-secondary/50 border-none shrink-0">
          <CardContent className="p-3 flex flex-row justify-between items-center gap-4">
            <div className="flex gap-10 flex-wrap">
              <div className="text-center">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Words</p>
                <p className="text-xl font-bold">{wordCount} <span className="text-muted-foreground text-base font-medium">/ {totalW}</span></p>
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

function ResultsPage({ result, finalWpm, onPracticeAgain }: any) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!result) {
      navigate('/selection');
    }
  }, [result, navigate]);

  if (!result) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full space-y-4 my-8">
        
        <div className="text-center space-y-1 mb-4">
          <h2 className="text-3xl font-bold flex items-center justify-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <span className="text-emerald-600">
              Practice Submitted Successfully
            </span>
          </h2>
          <p className="text-muted-foreground text-[12pt]">Guest User | DEMO</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
              <Target className="w-6 h-6 mb-1 text-primary" />
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

          <Card className="bg-secondary/50">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1">
              <XCircle className="w-6 h-6 mb-1 text-foreground" />
              <p className="text-sm uppercase tracking-wider font-bold text-muted-foreground">Total Mistakes</p>
              <p className="text-3xl font-bold leading-none text-foreground">{result.totalErrorScore.toFixed(1)}</p>
              <p className="text-xs font-semibold text-muted-foreground">Max Allowed: {result.errorThreshold.toFixed(1)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4 justify-center text-sm flex-wrap">
          {[['bg-emerald-500','Correct'],['bg-red-500','Full mistake'],['bg-amber-500','Half mistake']].map(([cls, lbl]) => (
            <span key={lbl} className="flex items-center gap-1">
              <span className={`inline-block w-3 h-3 rounded-full ${cls}`}></span>
              <span className="text-muted-foreground">{lbl}</span>
            </span>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="shadow-md border-border/50 bg-secondary/30 flex flex-col">
            <CardHeader className="py-3 px-6">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Expected Text (Reference)
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-6 px-6 overflow-y-auto max-h-[40vh] custom-scrollbar">
              <div className="text-[12pt] leading-relaxed font-medium tracking-wide" dangerouslySetInnerHTML={{ __html: result.highlightedHTML }} />
            </CardContent>
          </Card>
          <Card className="shadow-md border-border/50 bg-secondary/30 flex flex-col">
            <CardHeader className="py-3 px-6">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" /> Your Typed Text
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-6 px-6 overflow-y-auto max-h-[40vh] custom-scrollbar">
              <div className="text-[12pt] leading-relaxed font-medium tracking-wide" dangerouslySetInnerHTML={{ __html: result.typedHTML || result.highlightedHTML }} />
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center pt-4 pb-8">
          <Button onClick={() => { onPracticeAgain(); navigate('/selection'); }} className="px-12 h-12 text-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
            Practice Another Paragraph
          </Button>
        </div>
      </div>
    </div>
  );
}
