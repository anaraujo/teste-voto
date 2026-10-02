import { useState } from 'react'
import type { OptionId, Question } from '../data/quiz.ts'
import { Button } from './ui/button.tsx'
import { Progress } from './ui/progress.tsx'
import { RadioGroup, RadioGroupItem } from './ui/radio-group.tsx'

interface QuestionStepProps {
  question: Question
  index: number
  total: number
  onAnswer: (optionId: OptionId) => void
}

/** Uma pergunta, suas opções e o progresso. */
export function QuestionStep({
  question,
  index,
  total,
  onAnswer,
}: QuestionStepProps) {
  const [selected, setSelected] = useState<OptionId | null>(null)

  /*
   * O clique (do mouse ou do Enter/Espaço num item focado) avança na hora, como
   * sempre foi. As setas, porém, só movem a seleção: se também avançassem, quem
   * navega pelo teclado atravessaria as 5 perguntas sem conseguir ler nenhuma.
   */
  const tone = (['primary', 'secondary', 'tertiary'] as const)[index % 3]

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Pergunta {index + 1} de {total}
        </p>
        <Progress value={index} max={total} tone={tone} />
      </header>

      <h2 className="text-2xl font-semibold tracking-tight text-balance">
        {question.title}
      </h2>
      {question.hint && (
        <p className="text-sm text-muted-foreground">{question.hint}</p>
      )}

      <RadioGroup
        value={selected ?? ''}
        onValueChange={setSelected}
        aria-label={question.title}
      >
        {question.options.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-background p-4 text-left transition-colors hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
          >
            <RadioGroupItem
              value={option.id}
              onClick={() => onAnswer(option.id)}
            />
            <span className="text-base">{option.label}</span>
          </label>
        ))}
      </RadioGroup>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          disabled={!selected}
          onClick={() => selected && onAnswer(selected)}
        >
          Confirmar resposta
        </Button>
      </div>
    </section>
  )
}
