import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { RecipeStep } from '@/types/recipe';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Timer, 
  Check, 
  RotateCcw, 
  AlertCircle,
  ChefHat
} from 'lucide-react';

interface RecipeStepsProps {
  steps: RecipeStep[];
  autoPlay?: boolean;
  showImages?: boolean;
}

interface StepTimer {
  duration: number;
  remaining: number;
  isActive: boolean;
}

export const RecipeSteps: React.FC<RecipeStepsProps> = ({
  steps,
  autoPlay = false,
  showImages = true,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [timers, setTimers] = useState<Record<number, StepTimer>>({});
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  // Initialize timers for steps that have duration
  useEffect(() => {
    const newTimers: Record<number, StepTimer> = {};
    steps.forEach((step, index) => {
      if (step.duration) {
        newTimers[index] = {
          duration: step.duration * 60, // Convert minutes to seconds
          remaining: step.duration * 60,
          isActive: false,
        };
      }
    });
    setTimers(newTimers);
  }, [steps]);

  // Timer effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isPlaying && timers[activeStep]?.isActive) {
      intervalId = setInterval(() => {
        setTimers(prev => {
          const current = prev[activeStep];
          if (!current) return prev;

          const newRemaining = Math.max(0, current.remaining - 1);
          
          // Timer finished
          if (newRemaining === 0 && current.remaining > 0) {
            // Play notification sound
            if ('speechSynthesis' in window) {
              window.speechSynthesis.speak(new SpeechSynthesisUtterance('Timer finished!'));
            }
            
            // Show notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Recipe Timer', {
                body: `Step ${activeStep + 1} timer finished!`,
                icon: '/favicon.ico',
              });
            }
          }

          return {
            ...prev,
            [activeStep]: {
              ...current,
              remaining: newRemaining,
              isActive: newRemaining > 0,
            },
          };
        });
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, activeStep, timers]);

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const handlePrev = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    setActiveStep(stepIndex);
  };

  const handleStepComplete = (stepIndex: number) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepIndex)) {
      newCompleted.delete(stepIndex);
    } else {
      newCompleted.add(stepIndex);
    }
    setCompletedSteps(newCompleted);
  };

  const handleStartTimer = (stepIndex: number) => {
    setTimers(prev => ({
      ...prev,
      [stepIndex]: {
        ...prev[stepIndex],
        isActive: true,
      },
    }));
  };

  const handlePauseTimer = (stepIndex: number) => {
    setTimers(prev => ({
      ...prev,
      [stepIndex]: {
        ...prev[stepIndex],
        isActive: false,
      },
    }));
  };

  const handleResetTimer = (stepIndex: number) => {
    const step = steps[stepIndex];
    if (step.duration) {
      setTimers(prev => ({
        ...prev,
        [stepIndex]: {
          duration: step.duration! * 60,
          remaining: step.duration! * 60,
          isActive: false,
        },
      }));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTimer = timers[activeStep];
  const progress = (completedSteps.size / steps.length) * 100;

  return (
    <div>
      {/* Header with Progress */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Cooking Steps
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {completedSteps.size} of {steps.length} completed
          </span>
          <div className="w-24 bg-gray-200 rounded-full h-2">
            <div
              className="bg-orange-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Current Step Timer */}
      {currentTimer && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Timer className="h-6 w-6 text-orange-600" />
              <div>
                <div className="text-sm font-medium text-orange-800">
                  Step {activeStep + 1} Timer
                </div>
                <div className="text-3xl font-bold text-orange-900">
                  {formatTime(currentTimer.remaining)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {currentTimer.isActive ? (
                <button
                  onClick={() => handlePauseTimer(activeStep)}
                  className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                >
                  <Pause className="h-5 w-5" />
                </button>
              ) : (
                <button
                  onClick={() => handleStartTimer(activeStep)}
                  className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                >
                  <Play className="h-5 w-5" />
                </button>
              )}
              
              <button
                onClick={() => handleResetTimer(activeStep)}
                className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {currentTimer.isActive && (
            <div className="mt-4">
              <div className="w-full bg-orange-200 rounded-full h-2">
                <div
                  className="bg-orange-600 h-2 rounded-full transition-all duration-1000"
                  style={{
                    width: `${((currentTimer.duration - currentTimer.remaining) / currentTimer.duration) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Steps */}
      <div className="space-y-6">
        {steps.map((step, index) => (
          <div key={step.id} className="relative">
            {/* Step Number and Line */}
            <div className="flex">
              <div className="flex flex-col items-center mr-6">
                <button
                  onClick={() => handleStepClick(index)}
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-colors ${
                    completedSteps.has(index)
                      ? 'bg-green-500 border-green-500 text-white'
                      : activeStep === index
                      ? 'bg-orange-600 border-orange-600 text-white'
                      : 'bg-white border-gray-300 text-gray-500 hover:border-orange-600'
                  }`}
                >
                  {completedSteps.has(index) ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </button>
                
                {index < steps.length - 1 && (
                  <div className={`w-0.5 h-16 mt-2 ${
                    completedSteps.has(index) ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 pb-8">
                <div className={`bg-white rounded-xl border transition-all ${
                  activeStep === index 
                    ? 'border-orange-300 shadow-md' 
                    : 'border-gray-200'
                }`}>
                  {/* Step Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h4 className={`font-semibold ${
                          activeStep === index ? 'text-orange-900' : 'text-gray-900'
                        }`}>
                          Step {step.stepNumber}
                        </h4>
                        
                        {step.duration && (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                            timers[index]?.isActive 
                              ? 'bg-orange-100 text-orange-800' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            <Timer className="h-3 w-3" />
                            {step.duration} min
                          </span>
                        )}
                        
                        {step.temperature && (
                          <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {step.temperature}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Step Body */}
                  <div className="p-4">
                    <div className="flex gap-4">
                      {/* Step Image */}
                      {showImages && step.imageUrl && (
                        <div className="flex-shrink-0">
                          <div className="relative w-48 h-36">
                            <Image
                              src={step.imageUrl}
                              alt={`Step ${step.stepNumber}`}
                              fill
                              className="object-cover rounded-lg"
                              sizes="200px"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Step Content */}
                      <div className="flex-1">
                        <p className="text-gray-700 leading-relaxed mb-4">
                          {step.instruction}
                        </p>
                        
                        {step.notes && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm text-blue-800">
                                  <strong>Note:</strong> {step.notes}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Step Actions */}
                        <div className="flex justify-between items-center">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStepComplete(index)}
                              className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                                completedSteps.has(index)
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <Check className="h-4 w-4" />
                              {completedSteps.has(index) ? 'Completed' : 'Mark Complete'}
                            </button>
                            
                            {step.duration && !timers[index]?.isActive && (
                              <button
                                onClick={() => handleStartTimer(index)}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors"
                              >
                                <Timer className="h-4 w-4" />
                                Start Timer
                              </button>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={handlePrev}
                              disabled={activeStep === 0}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                            >
                              <SkipBack className="h-4 w-4" />
                              Previous
                            </button>
                            <button
                              onClick={handleNext}
                              disabled={activeStep === steps.length - 1}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                            >
                              Next Step
                              <SkipForward className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Completion */}
      {completedSteps.size === steps.length && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-green-900 mb-2">
            Recipe Complete!
          </h3>
          <p className="text-green-700">
            Congratulations! You've completed all cooking steps.
          </p>
        </div>
      )}

      {/* Floating Navigation */}
      {activeStep < steps.length - 1 && (
        <button
          onClick={handleNext}
          className="fixed bottom-6 right-6 bg-orange-600 text-white p-4 rounded-full shadow-lg hover:bg-orange-700 transition-colors focus:outline-none focus:ring-4 focus:ring-orange-500 focus:ring-opacity-50"
          aria-label="next step"
        >
          <SkipForward className="h-6 w-6" />
        </button>
      )}

      {/* Step Progress Sidebar */}
      <div className="fixed left-6 top-1/2 -translate-y-1/2 hidden lg:block">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          <div className="flex flex-col gap-2">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => handleStepClick(index)}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-semibold transition-colors ${
                  completedSteps.has(index)
                    ? 'bg-green-500 border-green-500 text-white'
                    : activeStep === index
                    ? 'bg-orange-600 border-orange-600 text-white'
                    : 'bg-white border-gray-300 text-gray-500 hover:border-orange-600'
                }`}
              >
                {completedSteps.has(index) ? (
                  <Check className="h-3 w-3" />
                ) : (
                  index + 1
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};