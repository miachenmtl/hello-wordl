interface BottomRowProps {
  wordLength: number;
  revealedTotalScore: string;
}

export function BottomRow(props: BottomRowProps) {
  const { wordLength, revealedTotalScore } = props;
  const cells = Array(wordLength)
    .fill(0)
    .map((_, i) => <td key={i} className="Row-letter hidden" />);
  cells.push(
    <td key={wordLength} className="Row-Score">
      {revealedTotalScore}
    </td>
  );

  return (
    <tr key="bottom" className="Bottom-Row">
      {cells}
    </tr>
  );
}
