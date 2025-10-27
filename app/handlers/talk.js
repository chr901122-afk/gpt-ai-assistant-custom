import axios from 'axios';
import config from '../config/index.js'; // ✅ 修正路徑，確保不會出現 /var/config 錯誤
import { handleFulfilled, handleRejected, handleRequest } from './utils/index.js';

export const EVENT_TYPE_MESSAGE = 'message';
export const EVENT_TYPE_POSTBACK = 'postback';

export const SOURCE_TYPE_USER = 'user';
export const SOURCE_TYPE_GROUP = 'group';

export const MESSAGE_TYPE_TEXT = 'text';
export const MESSAGE_TYPE_STICKER = 'sticker';
export const MESSAGE_TYPE_AUDIO = 'audio';
export const MESSAGE_TYPE_IMAGE = 'image';
export const MESSAGE_TYPE_TEMPLATE = 'template';

export const TEMPLATE_TYPE_BUTTONS = 'buttons';

export const ACTION_TYPE_MESSAGE = 'message';
export const ACTION_TYPE_POSTBACK = 'postback';

export const QUICK_REPLY_TYPE_ACTION = 'action';

// ✅ LINE API client（用於一般訊息）
const client = axios.create({
  baseURL: 'https://api.line.me',
  timeout: config.LINE_TIMEOUT,
  headers: {
    'Accept-Encoding': 'gzip, deflate, compress',
  },
});

client.interceptors.request.use((c) => {
  c.headers.Authorization = `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}`;
  return handleRequest(c);
});

client.interceptors.response.use(handleFulfilled, (err) => {
  if (err.response?.data?.message) {
    err.message = err.response.data.message;
  }
  return handleRejected(err);
});

// ✅ 回覆訊息
const reply = ({
  replyToken,
  messages,
}) => client.post('/v2/bot/message/reply', {
  replyToken,
  messages,
});

// ✅ 取得群組資訊
const fetchGroupSummary = ({
  groupId,
}) => client.get(`/v2/bot/group/${groupId}/summary`);

// ✅ 取得使用者資訊
const fetchProfile = ({
  userId,
}) => client.get(`/v2/bot/profile/${userId}`);

// ✅ 第二個 LINE 資料下載 client（用於圖片、音訊下載）
const dataClient = axios.create({
  baseURL: 'https://api-data.line.me',
  timeout: config.LINE_TIMEOUT,
  headers: {
    'Accept-Encoding': 'gzip, deflate, compress',
  },
});

dataClient.interceptors.request.use((c) => {
  c.headers.Authorization = `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}`;
  return handleRequest(c);
});

dataClient.interceptors.response.use(handleFulfilled, (err) => {
  if (err.response?.data?.message) {
    err.message = err.response.data.message;
  }
  return handleRejected(err);
});

// ✅ 下載媒體內容（圖片或音檔）
const fetchContent = ({
  messageId,
}) => dataClient.get(`/v2/bot/message/${messageId}/content`, {
  responseType: 'arraybuffer',
});

// ✅ 匯出所有函式（保持與原始專案一致）
export {
  reply,
  fetchGroupSummary,
  fetchProfile,
  fetchContent,
};
