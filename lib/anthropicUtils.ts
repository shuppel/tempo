import { Anthropic, AnthropicError } from "@anthropic-ai/sdk";

// interface ModelInfo {
//   id: string;
//   created_at: string;
//   display_name: string;
// }
/**
 * Fetches the latest model version for a specific model family
 * @param modelFamily The model family to search for (e.g., "haiku", "sonnet", "opus")
 * @param fallbackModel The fallback model ID to use if no models are found or an error occurs
 * @returns Promise that resolves to the latest model ID string
 */
export async function getLatestModelVersion(
  modelFamily: string = "haiku",
  fallbackModel: string = "claude-3-haiku-20240307",
): Promise<string> {
  console.log(`Fetching latest ${modelFamily} model version...`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY is not set, using fallback model");
    return fallbackModel;
  }

  try {
    // Create a new instance of the Anthropic client
    const anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Call the list models endpoint
    const modelsList = await anthropicClient.models.list();

    // Filter models by the model family (e.g., "haiku")
    const familyModels = modelsList.data.filter((model) =>
      model.id.toLowerCase().includes(modelFamily.toLowerCase()),
    );

    if (familyModels.length === 0) {
      console.warn(
        `No ${modelFamily} models found, falling back to ${fallbackModel}`,
      );
      return fallbackModel;
    }

    // Sort models by creation date (newest first)
    familyModels.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    // Get the most recent model ID
    const latestModel = familyModels[0].id;
    console.log(`Selected latest ${modelFamily} model: ${latestModel}`);

    return latestModel;
  } catch (error) {
    console.error("Error fetching model list:", error);
    // Fallback to a known model if there's an error
    return fallbackModel;
  }
}

/**
 * Gets the most appropriate model based on requirements
 * @param options Configuration options for model selection
 * @returns Promise that resolves to the selected model ID
 */
export async function getOptimalModel(
  options: {
    preferredFamily?: string;
    fallbackModel?: string;
    maxTokensRequired?: number;
    prioritizeSpeed?: boolean;
  } = {},
): Promise<string> {
  const {
    preferredFamily = "haiku",
    fallbackModel = "claude-3-haiku-20240307",
    maxTokensRequired = 4000,
    prioritizeSpeed = true,
  } = options;

  // For large token requirements, we might want to use a different model family
  if (maxTokensRequired > 4000 && preferredFamily === "haiku") {
    console.log(
      `Token requirement of ${maxTokensRequired} exceeds Haiku's typical limit, considering Sonnet`,
    );
    if (!prioritizeSpeed) {
      return getLatestModelVersion("sonnet", "claude-3-sonnet-20240229");
    }
  }

  // Default to the latest version of the preferred family
  return getLatestModelVersion(preferredFamily, fallbackModel);
}

/**
 * Configuration options for creating model messages
 */
export interface ModelMessageOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

/**
 * Creates a message with the Anthropic API, handling model selection and retries
 * @param options Message creation options
 * @param retries Number of retries for overloaded errors
 * @returns Promise resolving to the API response
 */
export async function createModelMessage(
  options: ModelMessageOptions,
  retries: number = 3,
): Promise<import("@anthropic-ai/sdk").Anthropic.Message> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // If no model is specified, get the latest model
  const model = options.model || (await getLatestModelVersion());

  let lastError: AnthropicError | null = null;

  // Implement retry logic
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await anthropicClient.messages.create({
        model,
        max_tokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.7,
        messages: options.messages,
      });

      return result;
    } catch (error: unknown) {
      if (error instanceof AnthropicError) {
        lastError = error;
        // Handle overloaded errors with exponential backoff
        if (
          error.message &&
          error.message.includes("overloaded") &&
          attempt < retries
        ) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.warn(
            `API overloaded, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        // Handle model not found errors
        if (
          "status" in error &&
          typeof (error as { status?: unknown }).status === "number" &&
          (error as { status: number }).status === 404 &&
          error.message &&
          error.message.includes("model")
        ) {
          console.warn(
            `Model ${model} not found, falling back to default model`,
          );
          options.model = "claude-3-haiku-20240307"; // Hard fallback
          // One more retry with the fallback model
          if (attempt < retries) {
            continue;
          }
        }
        // Rethrow if we've exhausted retries or for other errors
        throw error;
      } else {
        // If error is not an AnthropicError, rethrow immediately
        throw error;
      }
    }
  }

  throw lastError;
}
