import { useEffect, useRef, useState, useCallback } from "react";
import { Row, RowState } from "./Row";
import { BottomRow } from "./BottomRow";
import dictionary from "./dictionary.json"; // has different lengths for easier syncing
import { Clue, clue, CluedLetter, describeClue, violation } from "./clue";
import { Keyboard } from "./Keyboard";
import StatisticsPopup from "./StatisticsPopup";
import targetList from "./targets.json";
import {
  describeSeed,
  dictionarySet,
  Difficulty,
  gameName,
  pick,
  resetRng,
  seed,
  speak,
  urlParam,
} from "./util";
import { decode, encode } from "./base64";
import letterPoints from "./letterPoints";

enum GameState {
  Playing,
  Won,
  Lost,
}

interface GameProps {
  maxGuesses: number;
  hidden: boolean;
  difficulty: Difficulty;
  colorBlind: boolean;
  keyboardLayout: string;
}

const targets = targetList.slice(0, targetList.indexOf("murky") + 1); // Words no rarer than this one
const WORD_LENGTH = 5;

function randomTarget(): string {
  const eligible = targets.filter((word) => word.length === WORD_LENGTH);
  let candidate: string;
  do {
    candidate = pick(eligible);
  } while (/\*/.test(candidate));
  return candidate;
}

function getChallengeUrl(target: string): string {
  return (
    window.location.origin +
    window.location.pathname +
    "?challenge=" +
    encode(target)
  );
}

function getCluedWordScore(cluedLetters: CluedLetter[]) {
  let wordScore = 0;
  cluedLetters.forEach(({ clue, letter }, i) => {
    if (clue === Clue.Absent) wordScore += letterPoints[letter];
    else if (clue === Clue.Elsewhere) wordScore += letterPoints[letter] / 2;
  });
  return wordScore;
}

function getWordScore(word: string): number {
  return word.split("").reduce((acc, letter) => {
    return acc + letterPoints[letter];
  }, 0);
}

let initChallenge = "";
let challengeError = false;
try {
  initChallenge = decode(urlParam("challenge") ?? "").toLowerCase();
} catch (e) {
  console.warn(e);
  challengeError = true;
}
if (initChallenge && !dictionarySet.has(initChallenge)) {
  initChallenge = "";
  challengeError = true;
}

function parseUrlGameNumber(): number {
  const gameParam = urlParam("game");
  if (!gameParam) return 1;
  const gameNumber = Number(gameParam);
  return gameNumber >= 1 && gameNumber <= 1000 ? gameNumber : 1;
}

const getScoreHistory = () => {
  try {
    const item = window.localStorage.getItem("SCORE_HISTORY");
    if (item === null) return [];
    const parsedItem = JSON.parse(item);
    if (!Array.isArray(parsedItem)) return [];
    return parsedItem;
  } catch (e) {
    return [];
  }
};

const resetScoreHistory = () => {
  if (window.confirm("Are you sure you want to clear your scores?"))
    window.localStorage.removeItem("SCORE_HISTORY");
};

function useStatistics(): {
  getScoreHistory: () => number[];
  addScore: (newScore: number) => void;
  resetScoreHistory: () => void;
} {
  const addScore = (newScore: number) => {
    const scoreHistory = getScoreHistory();
    scoreHistory.push(newScore);
    window.localStorage.setItem("SCORE_HISTORY", JSON.stringify(scoreHistory));
  };
  return { getScoreHistory, addScore, resetScoreHistory };
}

function Game(props: GameProps) {
  const [gameState, setGameState] = useState(GameState.Playing);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState<string>("");
  const [totalScore, setTotalScore] = useState<number>(0);
  const [revealedTotalScore, setRevealedTotalScore] = useState<string>("");
  const [challenge, setChallenge] = useState<string>(initChallenge);
  const [gameNumber, setGameNumber] = useState(parseUrlGameNumber());
  const [target, setTarget] = useState(() => {
    resetRng();
    // Skip RNG ahead to the parsed initial game number:
    for (let i = 1; i < gameNumber; i++) randomTarget();
    return challenge || randomTarget();
  });
  const [hint, setHint] = useState<string>(
    challengeError
      ? `Invalid challenge string, playing random game.`
      : `Make your first guess!`
  );

  const [hasRevealed, setHasRevealed] = useState<boolean>(false);
  const [delayedHint, setDelayedHint] = useState<string>("");
  const [hasOpenPopup, setHasOpenPopup] = useState<boolean>(false);
  const { getScoreHistory, addScore, resetScoreHistory } = useStatistics();
  const scoreHistory = getScoreHistory();

  const getCurrentSeedParams = useCallback(
    () => `?seed=${seed}&length=${WORD_LENGTH}&game=${gameNumber}`,
    [gameNumber]
  );
  useEffect(() => {
    if (seed) {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + getCurrentSeedParams()
      );
    }
  }, [gameNumber, getCurrentSeedParams]);
  const tableRef = useRef<HTMLTableElement>(null);
  const startNextGame = () => {
    if (challenge) {
      // Clear the URL parameters:
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setChallenge("");
    setTarget(randomTarget());
    setHint("");
    setGuesses([]);
    setCurrentGuess("");
    setRevealedTotalScore("");
    setGameState(GameState.Playing);
    setGameNumber((x) => x + 1);
    setHasRevealed(false); // hackiness....
    setHasRevealed(true);
  };

  async function share(copiedHint: string, text?: string) {
    const url = seed
      ? window.location.origin +
        window.location.pathname +
        getCurrentSeedParams()
      : getChallengeUrl(target);
    const body = url + (text ? "\n\n" + text : "");
    if (
      /android|iphone|ipad|ipod|webos/i.test(navigator.userAgent) &&
      !/firefox/i.test(navigator.userAgent)
    ) {
      try {
        await navigator.share({ text: body });
        return;
      } catch (e) {
        console.warn("navigator.share failed:", e);
      }
    }
    try {
      await navigator.clipboard.writeText(body);
      setHint(copiedHint);
      return;
    } catch (e) {
      console.warn("navigator.clipboard.writeText failed:", e);
    }
    setHint(url);
  }

  const onKey = useCallback(
    (key: string) => {
      if (gameState !== GameState.Playing) {
        if (key === "Enter") {
          startNextGame();
        }
        return;
      }
      if (guesses.length === props.maxGuesses) return;
      if (/^[a-z]$/i.test(key)) {
        setCurrentGuess((guess) =>
          (guess + key.toLowerCase()).slice(0, WORD_LENGTH)
        );
        tableRef.current?.focus();
        setHint("");
      } else if (key === "Backspace") {
        setCurrentGuess((guess) => guess.slice(0, -1));
        setHint("");
      } else if (key === "Enter") {
        if (currentGuess.length !== WORD_LENGTH) {
          setHint("Too short");
          return;
        }
        if (!dictionary.includes(currentGuess)) {
          setHint("Not a valid word");
          return;
        }
        for (const g of guesses) {
          const c = clue(g, target);
          const feedback = violation(props.difficulty, c, currentGuess);
          if (feedback) {
            setHint(feedback);
            return;
          }
        }
        setGuesses((guesses) => guesses.concat([currentGuess]));
        setCurrentGuess((guess) => "");
      }
    },
    // eslint-disable-next-line
    [currentGuess, gameState, target, startNextGame]
  );

  // Runs after every guess
  useEffect(() => {
    const gameOver = (verbed: string) => {
      const score = guesses
        .map((guess) => clue(guess, target))
        .map(getCluedWordScore)
        .reduce((acc, val) => acc + val);
      const message = `You ${verbed}! The answer was ${target.toUpperCase()}. Your score was ${score}. (Enter to ${
        challenge ? "play a random game" : "play again"
      })`;
      addScore(score);
      return message;
    };

    let runningScore = 0;

    guesses.forEach((guess, i) => {
      const cluedLetters = clue(guess, target);
      runningScore += getCluedWordScore(cluedLetters);
    });

    setTotalScore(runningScore);

    if (currentGuess === target) {
      setDelayedHint(gameOver("won"));
      setGameState(GameState.Won);
    } else if (guesses.length === props.maxGuesses) {
      setDelayedHint(gameOver("lost"));
      setGameState(GameState.Lost);
    } else {
      setHint("");
      speak(describeClue(clue(currentGuess, target)));
    }
  }, [guesses]); // eslint-disable-line

  useEffect(() => {
    if (hasRevealed) {
      setRevealedTotalScore(totalScore.toString());
      if (GameState.Won || GameState.Lost) {
        setHint(delayedHint);
        setDelayedHint("");
        setHasRevealed(false);
      }
    }
  }, [hasRevealed, delayedHint, totalScore]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        onKey(e.key);
      }
      if (e.key === "Backspace") {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [currentGuess, gameState, onKey]);

  let letterInfo = new Map<string, Clue>();
  const tableRows = Array(props.maxGuesses)
    .fill(undefined)
    .map((_, i) => {
      const guess = [...guesses, currentGuess][i] ?? "";
      const cluedLetters = clue(guess, target);
      const lockedIn = i < guesses.length;
      if (lockedIn) {
        for (const { clue, letter } of cluedLetters) {
          if (clue === undefined) break;
          const old = letterInfo.get(letter);
          if (old === undefined || clue > old) {
            letterInfo.set(letter, clue);
          }
        }
      }
      const editing = i === guesses.length;
      const score = lockedIn
        ? getCluedWordScore(cluedLetters)
        : getWordScore(guess);
      const hasScore =
        i < guesses.length || (i === guesses.length && currentGuess.length > 0);
      let annotation = hasScore ? score.toString() : null;
      return (
        <Row
          key={i}
          wordLength={WORD_LENGTH}
          rowState={
            lockedIn
              ? RowState.LockedIn
              : editing
              ? RowState.Editing
              : RowState.Pending
          }
          serializedCluedLetters={JSON.stringify(cluedLetters)}
          annotation={annotation}
          setHasRevealed={setHasRevealed}
        />
      );
    });

  tableRows.push(
    <BottomRow
      key="bottom"
      wordLength={WORD_LENGTH}
      revealedTotalScore={revealedTotalScore}
    />
  );

  return (
    <div className="Game" style={{ display: props.hidden ? "none" : "block" }}>
      <table
        className="Game-rows"
        tabIndex={0}
        aria-label="Table of guesses"
        ref={tableRef}
      >
        <tbody>{tableRows}</tbody>
      </table>
      <p
        role="alert"
        style={{
          userSelect: /https?:/.test(hint) ? "text" : "none",
          whiteSpace: "pre-wrap",
          margin: "8px 0",
        }}
      >
        {hint || `\u00a0` /* non-breaking space */}
      </p>
      <Keyboard
        layout={props.keyboardLayout}
        letterInfo={letterInfo}
        onKey={onKey}
        hasRevealed={hasRevealed}
      />
      <div className="Game-seed-info">
        {challenge
          ? "playing a challenge game"
          : seed
          ? `${describeSeed(seed)} — length ${WORD_LENGTH}, game ${gameNumber}`
          : "playing a random game"}
      </div>
      <p>
        <button
          onClick={() => {
            share("Link copied to clipboard!");
          }}
        >
          Share a link to this game
        </button>{" "}
        {gameState !== GameState.Playing && (
          <button
            onClick={() => {
              const emoji = props.colorBlind
                ? ["⬛", "🟦", "🟧"]
                : ["⬛", "🟨", "🟩"];
              const score = gameState === GameState.Lost ? "X" : guesses.length;
              share(
                "Result copied to clipboard!",
                `${gameName} ${score}/${props.maxGuesses}\n` +
                  guesses
                    .map((guess) =>
                      clue(guess, target)
                        .map((c) => emoji[c.clue ?? 0])
                        .join("")
                    )
                    .join("\n")
              );
            }}
          >
            Share emoji results
          </button>
        )}
      </p>
      <button
        onClick={() => {
          setHasOpenPopup(true);
        }}
      >
        Statistics
      </button>
      <StatisticsPopup
        isOpen={hasOpenPopup}
        scoreHistory={scoreHistory}
        resetScoreHistory={resetScoreHistory}
        closePopup={() => {
          setHasOpenPopup(false);
        }}
      />
    </div>
  );
}

export default Game;
