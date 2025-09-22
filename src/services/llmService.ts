/**
 * Utility for calling the LLM API and returning parsed test plan JSON.
 */
export async function fetchTestCasesFromLLM({
  prompt,
  apiUrl,
  apiKey,
  modelName,
  temperature,
  maxTokens,
  logger,
}: {
  prompt: string;
  apiUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  logger: { info: (msg: string) => void; error: (msg: string) => void };
}): Promise<any[]> {
  logger.info(`[LLM] Calling LLM API at ${apiUrl}`);
  let llmJSON: any;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that generates software test cases.",
          },
          { role: "user", content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    const data = await response.json();
    logger.info(`[LLM] Raw response: ${JSON.stringify(data)}`);
    if (
      !data.choices ||
      !data.choices[0] ||
      !data.choices[0].message ||
      !data.choices[0].message.content
    ) {
      logger.error(`[LLM] Bad response from LLM: ${JSON.stringify(data)}`);
      throw new Error("Bad response from LLM: " + JSON.stringify(data));
    }

    const content = data.choices[0].message.content.trim();
    // Use a multiline-safe regex to extract the full array
    let match = content.match(/\[[\s\S]*\]/);
    if (!match) {
      logger.error(
        `[LLM] No JSON array found in LLM response. Raw content below:\n-----BEGIN LLM CONTENT-----\n${content}\n-----END LLM CONTENT-----`
      );
      logger.error(
        `[LLM] Full raw API response object:\n${JSON.stringify(data, null, 2)}`
      );
      throw new Error("No JSON array found in LLM response.");
    }
    try {
      llmJSON = JSON.parse(match[0]);
    } catch (parseErr: any) {
      logger.error(
        `[LLM] Failed to parse JSON from LLM response. Raw output: ${content}\n[DEBUG] match[0]:\n${
          match[0]
        }\n[DEBUG] Parse error:\n${
          parseErr && parseErr.message ? parseErr.message : String(parseErr)
        }`
      );
      throw new Error(
        "Failed to parse JSON from LLM response: " +
          (parseErr && parseErr.message ? parseErr.message : String(parseErr))
      );
    }
  } catch (error: any) {
    logger.error(
      `[LLM] Failed to generate test cases in JSON format from LLM: ${error.message}`
    );
    throw new Error(
      "Failed to generate test cases in JSON format from LLM: " +
        error.message
    );
  }

  return llmJSON;
}
