// babel.config.js (for Jest only)
module.exports = {
  presets: [
    [
      "next/babel",
      {
        "preset-react": {
          runtime: "automatic",
          importSource: "@emotion/react", // remove this if you're not using Emotion
        },
      },
    ],
  ],
};
