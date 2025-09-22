import { fetchTestCasesFromLLM } from "../../src/services/llmService";

// Create a global mock for fetch
const originalFetch = global.fetch;

describe("fetchTestCasesFromLLM", () => {
  let fetchMock: jest.Mock;
  let logger: { info: jest.Mock; error: jest.Mock };
  let baseParams: any;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    logger = {
      info: jest.fn(),
      error: jest.fn(),
    };
    baseParams = {
      prompt: "Generate tests",
      apiUrl: "https://fake-llm.com/api",
      apiKey: "secret",
      modelName: "test-model",
      temperature: 0.7,
      maxTokens: 300,
      logger,
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("should call fetch with the correct arguments and return parsed JSON array", async () => {
    const mockArray = [{ foo: 1 }, { bar: 2 }];
    const fakeContent = `
      Some random text before.
      ${JSON.stringify(mockArray)}
      Some random text after.
    `;
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        choices: [
          {
            message: { content: fakeContent },
          },
        ],
      }),
    });

    const result = await fetchTestCasesFromLLM(baseParams);
    expect(fetchMock).toHaveBeenCalledWith(
      baseParams.apiUrl,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret",
        }),
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      `[LLM] Calling LLM API at ${baseParams.apiUrl}`
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("[LLM] Raw response:")
    );
    expect(result).toEqual(mockArray);
  });

  it("should throw error if response is missing choices/message/content", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({}),
    });
    await expect(fetchTestCasesFromLLM(baseParams)).rejects.toThrow(
      "Bad response from LLM"
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[LLM] Bad response from LLM:")
    );
  });

  it("should throw error if no JSON array is found in content", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        choices: [
          {
            message: { content: "No array here, just text." },
          },
        ],
      }),
    });
    await expect(fetchTestCasesFromLLM(baseParams)).rejects.toThrow(
      "No JSON array found in LLM response."
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[LLM] No JSON array found in LLM response.")
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[LLM] Full raw API response object:")
    );
  });

  it("should throw error if JSON parsing fails", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        choices: [
          {
            message: { content: '[ this is malformed JSON! ]' },
          },
        ],
      }),
    });
    await expect(fetchTestCasesFromLLM(baseParams)).rejects.toThrow(
      "Failed to parse JSON from LLM response"
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[LLM] Failed to parse JSON from LLM response.")
    );
  });

  it("should throw error and log if fetch throws (network or low-level error)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));
    await expect(fetchTestCasesFromLLM(baseParams)).rejects.toThrow(
      "Failed to generate test cases in JSON format from LLM: Network error"
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "[LLM] Failed to generate test cases in JSON format from LLM: Network error"
      )
    );
  });
});
