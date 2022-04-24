import { useEffect, useState } from "react";
import { motion, useAnimation } from "framer-motion";

import { Clue, clueClass, CluedLetter, clueWord } from "./clue";
import letterPoints from "./letterPoints";

export enum RowState {
  LockedIn,
  Editing,
  Pending,
}

interface RowProps {
  rowState: RowState;
  wordLength: number;
  serializedCluedLetters: string;
  annotation?: string | null;
  setHasRevealed?: React.Dispatch<React.SetStateAction<boolean>>;
}

const scoreVariants = {
  initial: {
    scale: 1,
  },
  unrevealed: {
    scale: 0,
  },
  revealed: {
    scale: 1,
  },
};

const cellVariants = {
  initial: {
    opacity: 1,
    backgroundColor: "rgba(0, 0, 0, 0)",
    transition: { duration: 0 },
  },
  unrevealed: {
    opacity: 0,
    rotateY: 0,
    transition: {
      duration: 0,
    },
  },
  revealed: (custom: string) => {
    const [clueType, index] = custom.split(".");
    return {
      opacity: 1,
      rotateY: 360,
      backgroundColor:
        clueType === "letter-absent"
          ? "rgb(162, 162, 162)"
          : clueType === "letter-elsewhere"
          ? "#e9c601"
          : "rgb(87, 172, 120)",
      transition: {
        delay: parseInt(index) * 0.2,
      },
    };
  },
};

export function Row(props: RowProps) {
  const isLockedIn = props.rowState === RowState.LockedIn;
  const isEditing = props.rowState === RowState.Editing;
  const { serializedCluedLetters, annotation, setHasRevealed } = props;

  const [displayedLetters, setDisplayedLetters] = useState<CluedLetter[]>([]);
  const [displayedAnnotation, setDisplayedAnnotation] = useState<
    string | null | undefined
  >("");

  const cellControls = useAnimation();
  const scoreControls = useAnimation();

  useEffect(() => {
    const triggerAnimation = async () => {
      await scoreControls.start("unrevealed");
      await cellControls.start("unrevealed");
      setDisplayedAnnotation(annotation);

      await cellControls.start("revealed");
      await scoreControls.start("revealed");
      setHasRevealed?.(true);
    };

    if (isLockedIn) {
      triggerAnimation();
    } else {
      scoreControls.start("initial");
      cellControls.start("initial");
      setDisplayedLetters(JSON.parse(serializedCluedLetters));
      setDisplayedAnnotation(annotation);
      setHasRevealed?.(false);
    }
  }, [
    isLockedIn,
    scoreControls,
    cellControls,
    serializedCluedLetters,
    annotation,
    setHasRevealed,
  ]);

  const letterDivs = displayedLetters
    .concat(Array(props.wordLength).fill({ clue: Clue.Absent, letter: "" }))
    .slice(0, props.wordLength)
    .map(({ clue, letter }, i) => {
      let pointValue = letterPoints[letter];
      if (isLockedIn) {
        if (clue === Clue.Elsewhere) pointValue /= 2;
        else if (clue === Clue.Correct) pointValue = 0;
      }
      return (
        <motion.td
          key={i}
          className="Row-letter"
          custom={
            typeof clue === "number" ? clueClass(clue) + "." + i.toString() : ""
          }
          variants={cellVariants}
          initial="initial"
          animate={cellControls}
          aria-live={isEditing ? "assertive" : "off"}
          aria-label={
            isLockedIn
              ? letter.toUpperCase() +
                (clue === undefined ? "" : ": " + clueWord(clue))
              : ""
          }
        >
          <span>
            {letter}
            <sub className="Button-subscript">{pointValue}</sub>
          </span>
        </motion.td>
      );
    });
  let rowClass = "Row";
  if (isLockedIn) rowClass += " Row-locked-in";

  return (
    <motion.tr className={rowClass}>
      {letterDivs}
      <motion.td
        className="Row-Score"
        variants={scoreVariants}
        initial="initial"
        animate={scoreControls}
      >
        {displayedAnnotation}
      </motion.td>
    </motion.tr>
  );
}
