import React from 'react';

export default function QA({ question = 'Question', choices = [], onAnswer = () => {}, canAnswer = true, selected = null, isFalling = false }) {
  const wrapperClass = ['qa-container'];
  if (isFalling) wrapperClass.push('fall');
  return (
    <div className={wrapperClass.join(' ')}>
      <div className="question-container">
        <h3 id="current-question" className="question-text">{question}</h3>
        <div className="choices-container">
          {choices.map((c, i) => {
            const isSelected = selected && selected.index === i;
            const classNames = ['choice-button'];
            if (isSelected) classNames.push(selected.correct ? 'correct' : 'incorrect');
            return (
              <button
                key={i}
                className={classNames.join(' ')}
                disabled={!canAnswer}
                onClick={() => onAnswer(i)}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
