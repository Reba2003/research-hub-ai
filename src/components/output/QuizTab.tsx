import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Check, X, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { QuizQuestion } from '@/types';

interface QuizTabProps {
  questions: QuizQuestion[];
}

// Mock quiz data
const mockQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'According to the research, what is the primary benefit of the mixed-methods approach?',
    options: [
      'It is faster to implement',
      'It captures nuances that pure statistical analysis would miss',
      'It requires fewer resources',
      'It is easier to replicate',
    ],
    correctAnswer: 1,
    explanation: 'The mixed-methods approach combines quantitative data with qualitative insights, allowing researchers to capture contextual nuances.',
    sourceId: 's1',
  },
  {
    id: 'q2',
    question: 'What does the study suggest about collaborative frameworks?',
    options: [
      'They are too complex to implement',
      'They lead to improved outcomes',
      'They are outdated methodologies',
      'They require extensive training',
    ],
    correctAnswer: 1,
    explanation: 'The evidence strongly supports that collaborative frameworks lead to improved outcomes across various metrics.',
    sourceId: 's2',
  },
  {
    id: 'q3',
    question: 'How many primary areas of focus emerge from the analyzed materials?',
    options: ['Two', 'Three', 'Four', 'Five'],
    correctAnswer: 1,
    explanation: 'Three primary areas of focus emerged from the research, each representing a key advancement in the field.',
    sourceId: 's1',
  },
];

export function QuizTab({ questions }: QuizTabProps) {
  const displayQuestions = questions.length > 0 ? questions : mockQuestions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const currentQuestion = displayQuestions[currentIndex];
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
    if (currentIndex < displayQuestions.length - 1) {
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
      <div className="flex h-full items-center justify-center p-6">
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
            You scored {score} out of {displayQuestions.length}
          </p>
          <div className="mb-6 flex justify-center gap-1">
            {displayQuestions.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full ${
                  i < score ? 'bg-success' : 'bg-destructive/50'
                }`}
              />
            ))}
          </div>
          <Button onClick={handleRestart} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retake Quiz
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Knowledge Check</h3>
              <p className="text-xs text-muted-foreground">
                Question {currentIndex + 1} of {displayQuestions.length}
              </p>
            </div>
          </motion.div>

          {/* Progress */}
          <div className="mb-6 flex gap-1">
            {displayQuestions.map((_, i) => (
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

          {/* Question */}
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

              {/* Explanation */}
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

      {/* Footer */}
      <div className="border-t border-border p-4">
        <Button
          onClick={handleNext}
          disabled={!showResult}
          className="w-full gap-2"
        >
          {currentIndex < displayQuestions.length - 1 ? (
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
