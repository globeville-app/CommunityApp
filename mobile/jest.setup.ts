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
          inviteUrl: shared.invite_url,
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

// Tests run like Expo Go: the build number comes from the app's config.
jest.mock("expo-application", () => ({ nativeBuildVersion: null, nativeApplicationVersion: null }));

// ---- Milestone 3 ----

// Location and background tasks. Tests set permissions with __setPermission
// and read what's being watched with __watched(). Nothing here can see a
// real location, and the app never asks for one.
jest.mock("expo-location", () => {
  let permission = { granted: false, canAskAgain: true };
  let watched: { task: string; regions: unknown[] } | null = null;
  return {
    __setPermission: (next: { granted: boolean; canAskAgain: boolean }) => {
      permission = next;
    },
    __watched: () => watched,
    __reset: () => {
      permission = { granted: false, canAskAgain: true };
      watched = null;
    },
    GeofencingEventType: { Enter: 1, Exit: 2 },
    requestForegroundPermissionsAsync: jest.fn(async () => permission),
    requestBackgroundPermissionsAsync: jest.fn(async () => permission),
    getBackgroundPermissionsAsync: jest.fn(async () => permission),
    hasStartedGeofencingAsync: jest.fn(async () => watched !== null),
    startGeofencingAsync: jest.fn(async (task: string, regions: unknown[]) => {
      watched = { task, regions };
    }),
    stopGeofencingAsync: jest.fn(async () => {
      watched = null;
    }),
  };
});

jest.mock("expo-task-manager", () => {
  const tasks = new Map<string, (mockBody: unknown) => unknown>();
  return {
    __tasks: tasks,
    defineTask: jest.fn((name: string, fn: (mockBody: unknown) => unknown) => tasks.set(name, fn)),
    isTaskDefined: jest.fn((name: string) => tasks.has(name)),
  };
});

// The map, as a plain view tests can "tap" with onPress.
jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MapView = ({ children, onPress, testID }: any) =>
    React.createElement(View, { testID, onPress, accessibilityRole: "image" }, children);
  const Marker = ({ coordinate }: any) =>
    React.createElement(View, { testID: "pin", accessibilityHint: `${coordinate.latitude},${coordinate.longitude}` });
  return { __esModule: true, default: MapView, Marker, PROVIDER_GOOGLE: "google" };
});

jest.mock("react-native-view-shot", () => ({ captureRef: jest.fn(async () => "file:///tmp/badge-card.png") }));
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn(async () => undefined), isAvailableAsync: jest.fn(async () => true) }));
