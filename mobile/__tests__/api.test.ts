/** The API client: headers, error shapes, and offline handling (fetch is faked). */
import * as FileSystem from "expo-file-system";

import { ApiError, getMyProfile, login, matchAddress, sendProblemReport, signup, updateLanguage, uploadPhoto } from "../src/api";

const nativeUpload = (FileSystem as unknown as { __upload: jest.Mock }).__upload;

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function reply(status: number, body: unknown) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

beforeEach(() => fetchMock.mockReset());

it("sends the token and JSON body to the configured server", async () => {
  fetchMock.mockReturnValue(reply(200, { neighborhood_id: 1, name: "Hale", aliases: [] }));
  await matchAddress("tok", "1 Main St");
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("http://test-server:8000/api/join/match");
  expect(options.method).toBe("POST");
  expect(options.headers.Authorization).toBe("Token tok");
  expect(JSON.parse(options.body)).toEqual({ address: "1 Main St" });
});

it("turns backend errors into ApiError with the code and field codes", async () => {
  fetchMock.mockReturnValue(reply(400, { code: "email_taken", fields: { email: ["email_taken"] } }));
  await expect(login("a@b.co", "x")).rejects.toMatchObject({
    code: "email_taken",
    status: 400,
    fields: { email: ["email_taken"] },
  });
});

it("sends the chosen language at signup", async () => {
  fetchMock.mockReturnValue(reply(201, { token: "t", language: "es" }));
  await expect(signup("a@b.co", "pw", "es")).resolves.toEqual({ token: "t", language: "es" });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: "a@b.co", password: "pw", language: "es" });
});

it("saves a language change with PATCH /api/profile/me", async () => {
  fetchMock.mockReturnValue(reply(200, { language: "es" }));
  await updateLanguage("tok", "es");
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("http://test-server:8000/api/profile/me");
  expect(options.method).toBe("PATCH");
  expect(JSON.parse(options.body)).toEqual({ language: "es" });
});

it("turns a failed connection into a friendly network error", async () => {
  fetchMock.mockRejectedValue(new TypeError("Network request failed"));
  const error = await getMyProfile("tok").catch((e) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.code).toBe("network");
});

it("copes with an error reply that isn't JSON", async () => {
  fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error("html")) }));
  await expect(getMyProfile("tok")).rejects.toMatchObject({ code: "server_error", status: 502 });
});

it("never logs the address", async () => {
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
    jest.spyOn(console, level).mockImplementation(() => undefined),
  );
  fetchMock.mockRejectedValue(new TypeError("Network request failed"));
  await matchAddress("tok", "3300 Example Blvd").catch(() => undefined);
  for (const spy of spies) {
    expect(JSON.stringify(spy.mock.calls)).not.toContain("Example");
    spy.mockRestore();
  }
});

describe("timeouts", () => {
  // A fake server that never answers; the request ends only when the app gives up.
  function hang(_url: string, options: { signal: AbortSignal }) {
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")));
    });
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("reports a slow server as a timeout, not as being offline", async () => {
    fetchMock.mockImplementation(hang);
    const result = getMyProfile("tok").catch((e) => e);
    jest.advanceTimersByTime(15000);
    const error = await result;
    expect(error.code).toBe("timeout");
  });

  it("gives photo uploads much longer than other requests", async () => {
    // The native uploader (expo-file-system) hangs until the time limit aborts it.
    nativeUpload.mockImplementation(
      (_uri: string, _url: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    let settled = false;
    const result = uploadPhoto("tok", { uri: "file:///p.jpg", mimeType: "image/jpeg" })
      .catch((e) => e)
      .finally(() => {
        settled = true;
      });
    jest.advanceTimersByTime(60000);
    await Promise.resolve();
    expect(settled).toBe(false); // still waiting after a minute
    jest.advanceTimersByTime(30000);
    expect((await result).code).toBe("timeout");
  });
});

describe("photo uploads (native uploader, not fetch)", () => {
  beforeEach(() => nativeUpload.mockReset());

  it("sends the file as a multipart form with the login token", async () => {
    nativeUpload.mockResolvedValue({ status: 200, body: JSON.stringify({ first_name: "Ana" }), headers: {} });
    const profile = await uploadPhoto("tok", { uri: "file:///p.jpg", mimeType: "image/jpeg" });
    expect(profile).toEqual({ first_name: "Ana" });
    const [uri, url, options] = nativeUpload.mock.calls[0];
    expect(uri).toBe("file:///p.jpg");
    expect(url).toBe("http://test-server:8000/api/profile/photo");
    expect(options).toMatchObject({
      httpMethod: "POST",
      uploadType: FileSystem.UploadType.MULTIPART,
      fieldName: "photo",
      mimeType: "image/jpeg",
      headers: { Authorization: "Token tok", Accept: "application/json" },
    });
  });

  it("passes on the server's error code", async () => {
    nativeUpload.mockResolvedValue({ status: 400, body: JSON.stringify({ code: "photo_wrong_type" }), headers: {} });
    const error = await uploadPhoto("tok", { uri: "file:///p.jpg", mimeType: "image/jpeg" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("photo_wrong_type");
    expect(error.status).toBe(400);
  });

  it("a phone-side failure says 'network' and keeps the phone's reason", async () => {
    nativeUpload.mockRejectedValue(new Error("The file couldn't be read."));
    const error = await uploadPhoto("tok", { uri: "file:///p.jpg", mimeType: "image/jpeg" }).catch((e) => e);
    expect(error.code).toBe("network");
    expect(error.detail).toBe("The file couldn't be read.");
  });

  it("problem reports with a screenshot send the details as form fields", async () => {
    nativeUpload.mockResolvedValue({ status: 201, body: JSON.stringify({ id: 7 }), headers: {} });
    const result = await sendProblemReport(
      null,
      {
        message: "Broken",
        screenshot: { uri: "file:///s.jpg", mimeType: "image/jpeg" },
        app_version: "1.0.1 (2)",
        os: "iOS 19.1",
        device_model: "iPhone 16",
        language: "en",
        screen: "settings",
      },
      "key-1",
    );
    expect(result).toEqual({ id: 7 });
    const [, url, options] = nativeUpload.mock.calls[0];
    expect(url).toBe("http://test-server:8000/api/support/report");
    expect(options.fieldName).toBe("screenshot");
    expect(options.parameters).toEqual({
      message: "Broken",
      app_version: "1.0.1 (2)",
      os: "iOS 19.1",
      device_model: "iPhone 16",
      language: "en",
      screen: "settings",
    });
    expect(options.headers["Idempotency-Key"]).toBe("key-1");
    expect(options.headers.Authorization).toBeUndefined();
  });
});
