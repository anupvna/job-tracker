import { leetcodeUrl, videoUrl, type Difficulty, type Problem } from '@job-tracker/shared';
import { Check, ExternalLink, PlayCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  Hard: 'bg-red-50 text-red-700 ring-red-200',
};

export function DifficultyPill({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={cn('rounded-full px-1.5 py-px text-[11px] font-medium ring-1', DIFFICULTY_STYLES[difficulty])}>
      {difficulty}
    </span>
  );
}

interface Props {
  problem: Problem;
  solved: boolean;
  onToggle: (problem: Problem, solved: boolean) => void;
  /** Show the topic under the title (useful outside the topic list). */
  showTopic?: boolean;
}

/** One NeetCode problem: tick box, title, difficulty, and links out to LeetCode / the video. */
export function ProblemRow({ problem, solved, onToggle, showTopic }: Props) {
  const video = videoUrl(problem.video);
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={solved}
        aria-label={`${solved ? 'Unmark' : 'Mark'} “${problem.title}” as solved`}
        onClick={() => onToggle(problem, !solved)}
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
          solved ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-300 bg-white hover:border-zinc-500',
        )}
      >
        {solved && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
      </button>

      <div className="min-w-0 flex-1">
        <a
          href={leetcodeUrl(problem.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'text-sm font-medium hover:underline',
            solved ? 'text-zinc-400 line-through' : 'text-zinc-900',
          )}
        >
          {problem.title}
        </a>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <DifficultyPill difficulty={problem.difficulty} />
          {showTopic && <span>{problem.topic}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {video && (
          <a
            href={video}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Watch the NeetCode explanation for ${problem.title}`}
            title="NeetCode video"
            className="inline-flex size-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
          >
            <PlayCircle className="size-4" />
          </a>
        )}
        <a
          href={leetcodeUrl(problem.slug)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${problem.title} on LeetCode`}
          title="Open on LeetCode"
          className="inline-flex size-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>
    </li>
  );
}
