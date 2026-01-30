import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PodcastScript } from '@/types';

interface PodcastTabProps {
  podcast: PodcastScript | null;
}

// Mock podcast data
const mockPodcast: PodcastScript = {
  id: '1',
  title: 'Research Deep Dive',
  duration: 480,
  segments: [
    {
      id: 'seg1',
      speaker: 'host',
      content: "Welcome to today's research breakdown. We're diving deep into the fascinating findings from your uploaded sources.",
      timestamp: 0,
    },
    {
      id: 'seg2',
      speaker: 'expert',
      content: "Thanks for having me. The research presents a compelling argument for rethinking traditional approaches. Let me highlight the key discoveries.",
      timestamp: 30,
    },
    {
      id: 'seg3',
      speaker: 'host',
      content: "What stands out most from the methodology used in these studies?",
      timestamp: 75,
    },
    {
      id: 'seg4',
      speaker: 'expert',
      content: "The mixed-methods approach is particularly innovative. By combining quantitative data with qualitative insights, the researchers were able to capture nuances that pure statistical analysis would miss.",
      timestamp: 90,
    },
    {
      id: 'seg5',
      speaker: 'host',
      content: "And what about the practical implications of these findings?",
      timestamp: 150,
    },
    {
      id: 'seg6',
      speaker: 'expert',
      content: "That's where it gets exciting. The research suggests actionable steps that practitioners can implement immediately. This bridges the gap between theory and practice beautifully.",
      timestamp: 165,
    },
  ],
};

export function PodcastTab({ podcast }: PodcastTabProps) {
  const displayPodcast = podcast || mockPodcast;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState([75]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const duration = displayPodcast.duration || 480;
  const progress = (currentTime / duration) * 100;

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{displayPodcast.title}</h3>
              <p className="text-xs text-muted-foreground">
                AI-generated discussion • {formatTime(duration)}
              </p>
            </div>
          </motion.div>

          {/* Script */}
          <div className="space-y-3">
            {displayPodcast.segments.map((segment, index) => (
              <motion.div
                key={segment.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-xl p-4 ${
                  segment.speaker === 'host'
                    ? 'bg-card border border-border'
                    : 'bg-primary/5 border border-primary/20'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-xs font-medium ${
                    segment.speaker === 'host' ? 'text-muted-foreground' : 'text-primary'
                  }`}>
                    {segment.speaker === 'host' ? 'Host' : 'Expert'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(segment.timestamp)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  {segment.content}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Audio Player */}
      <div className="border-t border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{formatTime(currentTime)}</span>
          <Slider
            value={[progress]}
            onValueChange={([val]) => setCurrentTime((val / 100) * duration)}
            max={100}
            step={0.1}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={volume}
              onValueChange={setVolume}
              max={100}
              className="w-20"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-11 w-11"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="w-24" />
        </div>
      </div>
    </div>
  );
}
