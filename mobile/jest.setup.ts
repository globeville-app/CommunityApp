/**
 * Fakes for the phone's native features, used by every test.
 * Tests never touch real storage, the photo library, or the network.
 */

// Secure storage: an in-memory map tests can inspect.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

// The photo library picker.
jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  UIImagePickerPreferredAssetRepresentationMode: {
    Automatic: "automatic",
    Compatible: "compatible",
    Current: "current",
  },
}));

// App config: the name comes from the same shared file the real app uses.
jest.mock("expo-constants", () => {
  const shared = require("../shared/app_config.json");
  return {
    __esModule: true,
    default: { expoConfig: { name: shared.app_name, extra: { apiBaseUrl: "http://test-server:8000" } } },
  };
});

// Fonts load instantly in tests.
jest.mock("expo-font", () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: jest.fn(async () => undefined),
}));

// The language preference store (src/i18n/languageStorage.ts): in memory.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// The phone's language settings. Tests change __setLocale to simulate a
// Spanish phone.
jest.mock("expo-localization", () => {
  let tag = "en-US";
  return {
    __setLocale: (next: string) => {
      tag = next;
    },
    getLocales: () => [{ languageTag: tag, languageCode: tag.split("-")[0] }],
  };
});
