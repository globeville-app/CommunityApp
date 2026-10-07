/** The API client: headers, error shapes, and offline handling (fetch is faked). */
import { ApiError, NETWORK_ERROR_MESSAGE, getMyProfile, matchAddress } from "../src/api";

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

it("turns backend errors into ApiError with code and message", async () => {
  fetchMock.mockReturnValue(reply(404, { code: "profile_not_found", detail: "You haven't finished joining yet." }));
  await expect(getMyProfile("tok")).rejects.toMatchObject({
    code: "profile_not_found",
    message: "You haven't finished joining yet.",
    status: 404,
  });
});

it("turns a failed connection into a friendly network error", async () => {
  fetchMock.mockRejectedValue(new TypeError("Network request failed"));
  const error = await getMyProfile("tok").catch((e) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.code).toBe("network");
  expect(error.message).toBe(NETWORK_ERROR_MESSAGE);
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
