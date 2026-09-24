import type { OptionId, Question } from '../data/quiz.ts'

interface QuestionStepProps {
  question: Question
  index: number
  total: number
  onAnswer: (optionId: OptionId) => void
}

export function QuestionStep({
  question,
  index,
  total,
  onAnswer,
}: QuestionStepProps) {
  return (
    <section>
      <p>
        Pergunta {index + 1} de {total}
      </p>
      <progress value={index} max={total} />
      <h2>{question.title}</h2>

      {question.options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onAnswer(option.id)}
        >
          {option.photo && (
            <img src={option.photo} alt="" width="200" height="150" />
          )}
          <span>{option.label}</span>
        </button>
      ))}
    </section>
  )
}