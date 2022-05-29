import React, { useState } from "react";

interface HistogramProps {
  scoreHistory: number[];
  average: number;
}

const getHistogramBuckets = (scoreHistory: number[]) => {
  const MAX_RANGE = 100;
  const bucketCount = MAX_RANGE / BUCKET_SIZE;
  const buckets = Array(bucketCount + 1).fill(0);

  scoreHistory.forEach((score) => {
    const bucketIndex = Math.floor(score / BUCKET_SIZE);
    if (bucketIndex >= bucketCount) {
      buckets[buckets.length - 1] += 1;
    } else {
      buckets[bucketIndex] += 1;
    }
  });

  return buckets;
};

const CANVAS_WIDTH = 270;
const BUCKET_SIZE = 10;

const Histogram = ({ scoreHistory, average }: HistogramProps) => {
  const [hasTooltip, setHasTooltip] = useState(false);
  const [hoveredBarIndex, setHoveredBarIndex] = useState(-1);
  const [tooltipCoordinates, setTooltipCoordinates] = useState([0, 0]);

  const counts = getHistogramBuckets(scoreHistory);
  const maxCount = Math.max(...counts);
  const heights = counts.map(
    (count) => `${Math.round((100 * count) / maxCount)}%`
  );

  const averageLineStyle = {
    left: `${(10 / 11) * average}%`,
  };

  return (
    <div className="Histogram-Container">
      {!isNaN(average) && (
        <div className="Average-Line" style={averageLineStyle} />
      )}
      {counts.map((count, i) => (
        <div
          style={{
            height: heights[i],
            width: `${CANVAS_WIDTH / counts.length}px`,
          }}
          className="Histogram-Bar"
          key={i}
          onMouseEnter={() => {
            setHasTooltip(true);
          }}
          onMouseLeave={() => {
            setHasTooltip(false);
          }}
          onMouseMove={({ clientX, clientY }) => {
            if (hasTooltip) {
              setTooltipCoordinates([clientX, clientY]);
              setHoveredBarIndex(i);
            }
          }}
        >
          {hasTooltip && i === hoveredBarIndex && (
            <div
              className="Histogram-Tooltip"
              style={{
                left: tooltipCoordinates[0] + 24,
                top: tooltipCoordinates[1] + 24,
              }}
            >
              <div>
                {i === counts.length - 1
                  ? `${i * BUCKET_SIZE}+`
                  : `${i * BUCKET_SIZE}-${(i + 1) * BUCKET_SIZE - 1}`}
                :&nbsp;
                <b>{count}</b>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default Histogram;
