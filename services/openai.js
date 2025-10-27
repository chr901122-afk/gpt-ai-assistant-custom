import axios from 'axios';
import FormData from 'form-data';
import config from '../config/index.js';
import { handleFulfilled, handleRejected, handleRequest } from './utils/index.js';

export const ROLE_SYSTEM = 'system';
export const ROLE_AI = 'assistant';
export const ROLE_HUMAN = 'user';

export const FINISH_REASON_STOP = 'stop';
export const FINISH_REASON_LENGTH = 'length';

export const IMAGE_SIZE_256 = '256x256';
export const IMAGE_SIZE_512 = '512x512';
export const IMAGE_SIZE_1024 = '1024x1024';

export const MODEL_GPT_3_5_TURBO = 'gpt-3.5-turbo';
export const MODEL_GPT_4_OMNI = 'gpt-4o';
export const MODEL_WHISPER_1 = 'whisper-1';
export const MODEL_DALL_E_3 = 'dall-e-3';

const client = axios.create({
  baseURL: config.OPENAI_BASE_URL,
  timeout: config.OPENAI_TIMEOUT,
  headers: {
    'Accept-Encoding': 'gzip, deflate, compress',
  },
});

client.interceptors.request.use((c) => {
  c.headers.Authorization = `Bearer ${config.OPENAI_API_KEY}`;
  return handleRequest(c);
});

client.interceptors.response.use(handleFulfilled, (err) => {
  if (err.response?.data?.error?.message) {
    err.message = err.response.data.error.message;
  }
  return handleRejected(err);
});

const hasImage = ({ messages }) => (
  messages.some(({ content }) => (
    Array.isArray(content) && content.some((item) => item.image_url)
  ))
);

const createChatCompletion = ({
  model = config.OPENAI_COMPLETION_MODEL,
  messages,
  temperature = config.OPENAI_COMPLETION_TEMPERATURE,
  maxTokens = config.OPENAI_COMPLETION_MAX_TOKENS,
  frequencyPenalty = config.OPENAI_COMPLETION_FREQUENCY_PENALTY,
  presencePenalty = config.OPENAI_COMPLETION_PRESENCE_PENALTY,
}) => {
  const body = {
    model: hasImage({ messages }) ? config.OPENAI_VISION_MODEL : model,
    messages,
    temperature,
    max_tokens: maxTokens,
    frequency_penalty: frequencyPenalty,
    presence_penalty: presencePenalty,
  };
  return client.post('/v1/chat/completions', body);
};

const createImage = ({
  model = config.OPENAI_IMAGE_GENERATION_MODEL,
  prompt,
  size = config.OPENAI_IMAGE_GENERATION_SIZE,
  quality = config.OPENAI_IMAGE_GENERATION_QUALITY,
  n = 1,
}) => {
  // set image size to 1024 when using the DALL-E 3 model and the requested size is 256 or 512.
  if (model === MODEL_DALL_E_3 && [IMAGE_SIZE_256, IMAGE_SIZE_512].includes(size)) {
    size = IMAGE_SIZE_1024;
  }

  return client.post('/v1/images/generations', {
    model,
    prompt,
    size,
    quality,
    n,
  });
};

const createAudioTranscriptions = ({
  buffer,
  file,
  model = MODEL_WHISPER_1,
}) => {
  const formData = new FormData();
  formData.append('file', buffer, file);
  formData.append('model', model);
  return client.post('/v1/audio/transcriptions', formData.getBuffer(), {
    headers: formData.getHeaders(),
  });
};

export {
  createAudioTranscriptions,
  createChatCompletion,
  createImage,
};

/**
 * 呼叫 OpenAI Assistant API (asst_xxx)
 * 使用你的 Assistant ID 來自動處理回答
 */
const runAssistant = async (userMessage) => {
  try {
    // Step 1: 建立 thread
    const threadRes = await client.post('/v1/threads', {
      messages: [{ role: 'user', content: userMessage }],
    });
    const threadId = threadRes.data.id;

    // Step 2: 啟動 Assistant
    const runRes = await client.post(`/v1/threads/${threadId}/runs`, {
      assistant_id: config.OPENAI_ASSISTANT_ID,
    });
    const runId = runRes.data.id;

    // Step 3: 等待完成
    let runStatus = 'in_progress';
    while (runStatus !== 'completed' && runStatus !== 'failed') {
      await new Promise((r) => setTimeout(r, 1000));
      const check = await client.get(`/v1/threads/${threadId}/runs/${runId}`);
      runStatus = check.data.status;
    }

    if (runStatus === 'failed') {
      return '⚠️ Assistant 執行失敗。';
    }

    // Step 4: 取得回覆訊息
    const messagesRes = await client.get(`/v1/threads/${threadId}/messages`);
    const messages = messagesRes.data.data;
    const lastMsg = messages[0].content[0].text.value;
    return lastMsg || '⚠️ 無法取得 Assistant 回覆。';
  } catch (err) {
    console.error('[OpenAI Assistant Error]', err.response?.data || err.message);
    return '⚠️ 無法連線至 OpenAI Assistant API。';
  }
};

export {
  createAudioTranscriptions,
  createChatCompletion,
  createImage,
  runAssistant, // ✅ 新增這個
};
