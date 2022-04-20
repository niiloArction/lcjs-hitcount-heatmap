import {
  AxisTickStrategies,
  ColorRGBA,
  emptyLine,
  lightningChart,
  LUT,
  PalettedFill,
  UIOrigins,
} from "@arction/lcjs";

document.body.style.margin = "0px";
const containerBounds = {
  width: window.innerWidth * devicePixelRatio,
  height: window.innerHeight * devicePixelRatio,
};

const RESOLUTION = {
  x: Math.ceil(containerBounds.width / 2),
  y: Math.ceil(containerBounds.height / 2),
};
console.log(`RESOLUTION: ${RESOLUTION.x}x${RESOLUTION.y}`);

const INCOMING_POINTS_PER_SECOND = 4 * 1000 * 1000;
const DECAY_HITS_PER_SECOND = 10;
const COLOR_LOOK_UP_TABLE = new LUT({
  interpolate: true,
  units: "Hit count",
  steps: [
    { value: 0, color: ColorRGBA(0, 0, 0, 0), label: "" },
    { value: 1, color: ColorRGBA(0, 0, 255) },
    { value: 10, color: ColorRGBA(255, 255, 0) },
    { value: 20, color: ColorRGBA(255, 0, 0) },
  ],
});

const debugStats = {
  frames: 0,
  delaySumDecay: 0,
  delaySumPlaceSamples: 0,
  delaySumUpdateHeatmap: 0,
};

const chart = lightningChart().ChartXY().setTitle("").setPadding(0);

chart.forEachAxis((axis) =>
  axis.setTickStrategy(AxisTickStrategies.Empty).setStrokeStyle(emptyLine)
);

const heatmap = chart
  .addHeatmapGridSeries({
    columns: RESOLUTION.x,
    rows: RESOLUTION.y,
    dataOrder: "columns",
  })
  .setName("Heatmap")
  .setFillStyle(
    new PalettedFill({
      lookUpProperty: "value",
      lut: COLOR_LOOK_UP_TABLE,
    })
  )
  .setWireframeStyle(emptyLine)
  .setIntensityInterpolation("bilinear");

const legend = chart.addLegendBox().add(chart);

console.time("initialize data matrix");
const data = new Array(RESOLUTION.x)
  .fill(0)
  .map((_) => new Array(RESOLUTION.y).fill(0));
console.timeEnd("initialize data matrix");

const decayCycle = (tDelta: number) => {
  if (DECAY_HITS_PER_SECOND <= 0) return;

  const decayAmount = (DECAY_HITS_PER_SECOND * tDelta) / 1000;
  for (let x = 0; x < RESOLUTION.x; x += 1) {
    for (let y = 0; y < RESOLUTION.y; y += 1) {
      const value = data[x][y];
      data[x][y] = value > 0 ? value - decayAmount : 0;
    }
  }
};

// #region ----- Simulate input data streaming -----

requestAnimationFrame(() => {
  console.time("generate random patterns");
  const randPatternX = new Array(
    Math.round(31515 / RESOLUTION.x) * RESOLUTION.x
  )
    .fill(0)
    .map((_, i) => {
      return i % RESOLUTION.x;
    });
  shuffleArray(randPatternX);
  const lenRandPatternX = randPatternX.length;
  let iRandPatternX = 0;
  const randPatternY = new Array(
    Math.round(32393 / RESOLUTION.y) * RESOLUTION.y
  )
    .fill(0)
    .map((_, i) => {
      return i % RESOLUTION.y;
    });
  shuffleArray(randPatternY);
  const lenRandPatternY = randPatternY.length;
  let iRandPatternY = 0;
  console.timeEnd("generate random patterns");

  let tPrev = window.performance.now();
  let newSamplesModulus = 0;
  const onFrame = () => {
    const tStart = window.performance.now();
    const tDelta = Math.min(tStart - tPrev, 2000);

    decayCycle(tDelta);
    const tAfterDecay = window.performance.now();

    let newSamplesCount =
      newSamplesModulus + (INCOMING_POINTS_PER_SECOND * tDelta) / 1000;
    newSamplesModulus = newSamplesCount % 1;
    newSamplesCount = Math.floor(newSamplesCount);

    for (let i = 0; i < newSamplesCount; i += 1) {
      const x = randPatternX[iRandPatternX];
      iRandPatternX = (iRandPatternX + 1) % lenRandPatternX;
      const y = randPatternY[iRandPatternY];
      iRandPatternY = (iRandPatternY + 1) % lenRandPatternY;

      // Place 1 sample into data array.
      data[x][y] += 1;
    }
    const tAfterNewSamples = window.performance.now();

    // Update heatmap with all new data values.
    heatmap.invalidateIntensityValues(data);
    const tAfterUpdateHeatmap = window.performance.now();

    debugStats.frames += 1;
    debugStats.delaySumDecay += tAfterDecay - tStart;
    debugStats.delaySumPlaceSamples += tAfterNewSamples - tAfterDecay;
    debugStats.delaySumUpdateHeatmap += tAfterUpdateHeatmap - tAfterNewSamples;
    tPrev = tStart;
    requestAnimationFrame(onFrame);
  };
  onFrame();
});

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// #endregion

setInterval(() => {
  const fps = 1000 / (5000 / debugStats.frames);
  console.log(
    `Debug stats:\n\tframes: ${debugStats.frames}\n\tfps: ${fps.toFixed(
      1
    )}\n\tavg decay: ${(debugStats.delaySumDecay / debugStats.frames).toFixed(
      1
    )} ms\n\tavg place samples: ${(
      debugStats.delaySumPlaceSamples / debugStats.frames
    ).toFixed(1)} ms\n\tavg update heatmap: ${(
      debugStats.delaySumUpdateHeatmap / debugStats.frames
    ).toFixed(1)} ms`
  );
  debugStats.frames = 0;
  debugStats.delaySumDecay = 0;
  debugStats.delaySumPlaceSamples = 0;
  debugStats.delaySumUpdateHeatmap = 0;
}, 5000);

const label = chart
  .addUIElement()
  .setPosition({ x: 0, y: 100 })
  .setOrigin(UIOrigins.LeftTop);
const updateLabel = () => {
  label.setText(
    `${Math.round(window.innerWidth * devicePixelRatio)}x${Math.round(
      window.innerHeight * devicePixelRatio
    )}`
  );
};
updateLabel();
window.addEventListener("resize", updateLabel);
