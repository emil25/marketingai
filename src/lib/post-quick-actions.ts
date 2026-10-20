export function replaceOpeningLine(text: string, opening: string) {
  const firstLineEnd = text.indexOf("\n");
  if (firstLineEnd >= 0) return `${opening.trim()}${text.slice(firstLineEnd)}`;
  const firstSentence = /[.!?](?:[”"']?)(?=\s|$)/u.exec(text);
  return firstSentence
    ? `${opening.trim()}${text.slice(firstSentence.index + firstSentence[0].length)}`
    : opening.trim();
}

export function appendQuestionClosing(text: string, question: string) {
  return `${text.trim()}\n\n${question.trim()}`;
}
