import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Check, X, RefreshCw, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateOutput } from '@/lib/api';
import { useResearchStore } from '@/hooks/useResearchStore';
import { toast } from 'sonner';
import type { QuizQuestion } from '@/types';

interface QuizTabProps {
  questions: QuizQuestion[];
}

export function QuizTab({ questions }: QuizTabProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { sources, setQuizQuestions } = useResearchStore();
  const enabledSources = sources.filter((s) => s.enabled && s.status === 'ready');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const handleGenerate = async () => {
    if (enabledSources.length === 0) {
      toast.error('No ready sources available. Upload and process sources first.');
      return;
    }

    setIsGenerating(true);
    try {
      const sourceIds = enabledSources.map(s => s.id);
      const result = await generateOutput('quiz', sourceIds);
      
      // generate-notebook-details returns { content: string } for quiz type
      const content = typeof result?.content === 'string' ? result.content : '';
      
      // Try to parse JSON quiz from the content
      let parsedQuestions: QuizQuestion[] = [];
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          parsedQuestions = parsed.map(
            (q: { question: string; options: string[]; correctIndex?: number; correct_answer?: number; explanation: string }, i: number) => ({
              id: `q-${i}`,
              question: q.question,
              options: q.options,
              correctAnswer: q.correctIndex ?? q.correct_answer ?? 0,
              explanation: q.explanation || '',
              sourceId: '',
            })
          );
        }
      } catch (e) {
        console.warn('Failed to parse quiz JSON:', e);
      }
      
      if (parsedQuestions.length > 0) {
        setQuizQuestions(parsedQuestions);
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setShowResult(false);
        setScore(0);
        setIsComplete(false);
        toast.success('Quiz generated!');
      } else {
        toast.error('Could not parse quiz questions from AI response');
      }
    } catch (error) {
      console.error('Generate quiz error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate quiz');
    } finally {
      setIsGenerating(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Brain className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">Generate Quiz</h3>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          Test your understanding with AI-generated quiz questions based on your sources.
        </p>
        <Button onClick={handleGenerate} disabled={isGenerating || enabledSources.length === 0} className="gap-2">
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Brain className="h-4 w-4" />
              Generate Quiz
            </>
          )}
        </Button>
        {enabledSources.length === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">Upload sources first</p>
        )}
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const isCorrect = selectedAnswer === currentQuestion?.correctAnswer;

  const handleSelect = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
    setShowResult(true);
    if (index === currentQuestion.correctAnswer) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setIsComplete(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setIsComplete(false);
  };

  if (isComplete) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Brain className="h-10 w-10 text-primary" />
          </div>
          <h3 className="mb-2 text-2xl font-bold text-foreground">Quiz Complete!</h3>
          <p className="mb-6 text-muted-foreground">
            You scored {score} out of {questions.length}
          </p>
          <div className="mb-6 flex justify-center gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full ${
                  i < score ? 'bg-success' : 'bg-destructive/50'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={handleRestart} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retake Quiz
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              New Quiz
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Knowledge Check</h3>
                <p className="text-xs text-muted-foreground">
                  Question {currentIndex + 1} of {questions.length}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={isGenerating} className="gap-1">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </motion.div>

          <div className="mb-6 flex gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < currentIndex
                    ? 'bg-primary'
                    : i === currentIndex
                    ? 'bg-primary/50'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <p className="mb-6 text-lg font-medium text-foreground">
                {currentQuestion.question}
              </p>

              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                  let className = 'rounded-xl border p-4 text-left transition-all w-full';
                  
                  if (showResult) {
                    if (index === currentQuestion.correctAnswer) {
                      className += ' border-success bg-success/10 text-foreground';
                    } else if (index === selectedAnswer) {
                      className += ' border-destructive bg-destructive/10 text-foreground';
                    } else {
                      className += ' border-border bg-card text-muted-foreground';
                    }
                  } else if (selectedAnswer === index) {
                    className += ' border-primary bg-primary/10 text-foreground';
                  } else {
                    className += ' border-border bg-card text-foreground hover:border-primary/50 hover:bg-card/80';
                  }

                  return (
                    <motion.button
                      key={index}
                      whileHover={!showResult ? { scale: 1.01 } : undefined}
                      whileTap={!showResult ? { scale: 0.99 } : undefined}
                      className={className}
                      onClick={() => handleSelect(index)}
                      disabled={showResult}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium ${
                          showResult && index === currentQuestion.correctAnswer
                            ? 'bg-success text-success-foreground'
                            : showResult && index === selectedAnswer
                            ? 'bg-destructive text-destructive-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {showResult && index === currentQuestion.correctAnswer ? (
                            <Check className="h-4 w-4" />
                          ) : showResult && index === selectedAnswer ? (
                            <X className="h-4 w-4" />
                          ) : (
                            String.fromCharCode(65 + index)
                          )}
                        </div>
                        <span className="text-sm">{option}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <AnimatePresence>
                {showResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 rounded-xl border border-border bg-card p-4"
                  >
                    <p className="text-sm text-muted-foreground">
                      <span className={`font-medium ${isCorrect ? 'text-success' : 'text-destructive'}`}>
                        {isCorrect ? 'Correct! ' : 'Not quite. '}
                      </span>
                      {currentQuestion.explanation}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4">
        <Button
          onClick={handleNext}
          disabled={!showResult}
          className="w-full gap-2"
        >
          {currentIndex < questions.length - 1 ? (
            <>
              Next Question
              <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            'See Results'
          )}
        </Button>
      </div>
    </div>
  );
}
