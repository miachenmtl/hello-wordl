import React from "react";
import Histogram from "./Histogram";

interface StatisticsPopupProps {
  isOpen: boolean;
  scoreHistory: number[];
  closePopup: () => void;
  resetScoreHistory: () => void;
}

const StatisticsPopup = ({
  isOpen,
  scoreHistory,
  closePopup,
  resetScoreHistory,
}: StatisticsPopupProps) => {
  const popupStyle = {
    display: isOpen ? "flex" : "none",
  };
  const totalAttempts = scoreHistory.length;
  const average =
    totalAttempts > 0
      ? scoreHistory.reduce((a, b) => a + b) / totalAttempts
      : NaN;

  return (
    <div className="Modal-Overlay" style={popupStyle}>
      <div className="Statistics-Popup">
        <div className="Popup-Flexbox">
          <h1>Statistics</h1>
          <div className="Statistics-Content">
            <Histogram average={average} scoreHistory={scoreHistory} />
            <p>Total attempts: {totalAttempts}</p>
            <p style={{ color: "pink" }}>
              Average score: {isNaN(average) ? "" : average.toFixed(2)}
            </p>
          </div>
          <div className="Popup-Buttons-Container">
            <button onClick={() => {}}>Share</button>
            <button onClick={resetScoreHistory}>Reset</button>
            <button onClick={closePopup}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPopup;
