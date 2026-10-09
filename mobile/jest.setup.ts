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
    default: {
      expoConfig: {
        name: shared.app_name,
        version: "1.0.0",
        extra: {
          apiBaseUrl: "http://test-server:8000",
          privacyUrl: shared.privacy_url,
          termsUrl: shared.terms_url,
          buildNumber: "12",
        },
      },
    },
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

// The in-app browser for the privacy policy and terms.
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "dismiss" })) }));

// The phone model and system, attached to problem reports.
jest.mock("expo-device", () => ({ modelName: "iPhone 16", osName: "iOS", osVersion: "19.1" }));

// The phone's date/time picker, as a text box tests can type into:
// "2026-10-24" for dates, "18:00" for times.
jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { TextInput } = require("react-native");
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    __esModule: true,
    default: ({ value, mode, onChange, accessibilityLabel }: any) =>
      React.createElement(TextInput, {
        accessibilityLabel,
        value:
          mode === "date"
            ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
            : `${pad(value.getHours())}:${pad(value.getMinutes())}`,
        onChangeText: (text: string) => {
          const date = new Date(value);
          if (mode === "date") {
            const [y, m, d] = text.split("-").map(Number);
            date.setFullYear(y, m - 1, d);
          } else {
            const [h, min] = text.split(":").map(Number);
            date.setHours(h, min);
          }
          onChange({ type: "set" }, date);
        },
      }),
  };
});
