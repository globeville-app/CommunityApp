/**
 * Test stand-in for react-native-reanimated: just the features the app uses
 * (the glow and the sliding sheet). Tests check behavior, not motion.
 * Wired up through "moduleNameMapper" in package.json.
 */
const { View } = require("react-native");

const entering = { duration: () => entering };
const Animated = { View, call: () => undefined };

module.exports = {
  __esModule: true,
  default: Animated,
  View,
  useSharedValue: (value) => ({ value }),
  useAnimatedStyle: (fn) => fn(),
  withRepeat: (value) => value,
  withTiming: (value) => value,
  cancelAnimation: () => undefined,
  useReducedMotion: () => false,
  Easing: { inOut: (fn) => fn, sin: (t) => t },
  SlideInDown: entering,
};
