// "react-native-reanimated" in tests. expo-router's test helpers replace it
// with "react-native-reanimated/mock", which is mapped to reanimatedMock.js;
// the two names must be different files or that lookup loops forever.
module.exports = require("./reanimatedMock.js");
