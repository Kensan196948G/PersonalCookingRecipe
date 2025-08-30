import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Card,
  CardContent,
  CardMedia,
  Tooltip,
  Alert,
  Timer,
  Fab,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipNext as NextIcon,
  SkipPrevious as PrevIcon,
  Timer as TimerIcon,
  Check as CheckIcon,
  Refresh as ResetIcon,
  VolumeUp as VolumeIcon,
} from '@mui/icons-material';
import { RecipeStep } from '@/types';

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

  const getStepIcon = (stepIndex: number) => {
    if (completedSteps.has(stepIndex)) {
      return <CheckIcon />;
    }
    return stepIndex + 1;
  };

  const currentTimer = timers[activeStep];

  return (
    <Box>
      {/* Header with Progress */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Cooking Steps
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="text.secondary">
            {completedSteps.size} of {steps.length} completed
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(completedSteps.size / steps.length) * 100}
            sx={{ width: 100, height: 8, borderRadius: 4 }}
          />
        </Box>
      </Box>

      {/* Current Step Timer */}
      {currentTimer && (
        <Card sx={{ mb: 3, backgroundColor: 'primary.light', color: 'primary.contrastText' }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box display="flex" alignItems="center" gap={2}>
                <TimerIcon />
                <Box>
                  <Typography variant="subtitle1">
                    Step {activeStep + 1} Timer
                  </Typography>
                  <Typography variant="h4">
                    {formatTime(currentTimer.remaining)}
                  </Typography>
                </Box>
              </Box>
              
              <Box display="flex" alignItems="center" gap={1}>
                {currentTimer.isActive ? (
                  <IconButton
                    onClick={() => handlePauseTimer(activeStep)}
                    sx={{ color: 'inherit' }}
                  >
                    <PauseIcon />
                  </IconButton>
                ) : (
                  <IconButton
                    onClick={() => handleStartTimer(activeStep)}
                    sx={{ color: 'inherit' }}
                  >
                    <PlayIcon />
                  </IconButton>
                )}
                
                <IconButton
                  onClick={() => handleResetTimer(activeStep)}
                  sx={{ color: 'inherit' }}
                >
                  <ResetIcon />
                </IconButton>
              </Box>
            </Box>
            
            {currentTimer.isActive && (
              <LinearProgress
                variant="determinate"
                value={((currentTimer.duration - currentTimer.remaining) / currentTimer.duration) * 100}
                sx={{ mt: 2, backgroundColor: 'rgba(255,255,255,0.3)' }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Steps */}
      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={step.id} completed={completedSteps.has(index)}>
            <StepLabel
              icon={getStepIcon(index)}
              onClick={() => handleStepClick(index)}
              sx={{
                cursor: 'pointer',
                '& .MuiStepLabel-label': {
                  fontSize: '1.1rem',
                  fontWeight: activeStep === index ? 600 : 400,
                },
              }}
            >
              <Box display="flex" alignItems="center" gap={2}>
                <Typography
                  variant={activeStep === index ? 'subtitle1' : 'body1'}
                  sx={{ fontWeight: activeStep === index ? 600 : 400 }}
                >
                  Step {step.stepNumber}
                </Typography>
                
                {step.duration && (
                  <Chip
                    icon={<TimerIcon />}
                    label={`${step.duration} min`}
                    size="small"
                    color={timers[index]?.isActive ? 'primary' : 'default'}
                    variant={timers[index]?.isActive ? 'filled' : 'outlined'}
                  />
                )}
                
                {step.temperature && (
                  <Chip
                    label={step.temperature}
                    size="small"
                    variant="outlined"
                    color="secondary"
                  />
                )}
              </Box>
            </StepLabel>
            
            <StepContent>
              <Paper sx={{ p: 3, mb: 2 }}>
                <Box display="flex" gap={3}>
                  {/* Step Image */}
                  {showImages && step.imageUrl && (
                    <Box sx={{ flexShrink: 0 }}>
                      <CardMedia
                        component="img"
                        image={step.imageUrl}
                        alt={`Step ${step.stepNumber}`}
                        sx={{
                          width: 200,
                          height: 150,
                          objectFit: 'cover',
                          borderRadius: 2,
                        }}
                      />
                    </Box>
                  )}
                  
                  {/* Step Content */}
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="body1"
                      sx={{ mb: 2, lineHeight: 1.6 }}
                    >
                      {step.instruction}
                    </Typography>
                    
                    {step.notes && (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          <strong>Note:</strong> {step.notes}
                        </Typography>
                      </Alert>
                    )}
                    
                    {/* Step Actions */}
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" gap={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleStepComplete(index)}
                          startIcon={completedSteps.has(index) ? <CheckIcon /> : undefined}
                          color={completedSteps.has(index) ? 'success' : 'primary'}
                        >
                          {completedSteps.has(index) ? 'Completed' : 'Mark Complete'}
                        </Button>
                        
                        {step.duration && !timers[index]?.isActive && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleStartTimer(index)}
                            startIcon={<TimerIcon />}
                          >
                            Start Timer
                          </Button>
                        )}
                      </Box>
                      
                      <Box display="flex" gap={1}>
                        <Button
                          size="small"
                          onClick={handlePrev}
                          disabled={activeStep === 0}
                          startIcon={<PrevIcon />}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleNext}
                          disabled={activeStep === steps.length - 1}
                          endIcon={<NextIcon />}
                        >
                          Next Step
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {/* Completion */}
      {completedSteps.size === steps.length && (
        <Paper sx={{ p: 3, mt: 3, backgroundColor: 'success.light', color: 'success.contrastText' }}>
          <Box textAlign="center">
            <CheckIcon sx={{ fontSize: 48, mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Recipe Complete!
            </Typography>
            <Typography variant="body1">
              Congratulations! You've completed all cooking steps.
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Floating Navigation */}
      {activeStep < steps.length - 1 && (
        <Fab
          color="primary"
          aria-label="next step"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
          }}
          onClick={handleNext}
        >
          <NextIcon />
        </Fab>
      )}
    </Box>
  );
};