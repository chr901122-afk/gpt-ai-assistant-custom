import axios from 'axios';
import config from '../config/index.js';
import { t } from '../locales/index.js';

// ✅ 修正所有 app 相關模組的路徑
import { COMMAND_BOT_CONTINUE, COMMAND_BOT_FORGET, COMMAND_BOT_TALK } from '../app/commands/index.js';
import Context from '../app/context.js';
import { updateHistory } from '../app/history/index.js';
import { getPrompt, setPrompt } from '../app/prompt/index.js';

// ✅ 同層級 service 引用保持不動
import { runAssistant } from '../services/openai.js';


/**
 * @param {Context} context
 * @returns {boolean}
 */
const check = (context) => (
  context.hasCommand(COMMAND_BOT_TALK)
  || context.hasBotName
  || context.source.bot.isActivated
);

/**
 * @param {Context} context
 * @returns {Promise<Context>}
 */
const exec = (context) => check(context) && (
  async () => {
    const prompt = getPrompt(context.userId);
    try {
      let userMessage = '';

      // 處理文字輸入
      if (context.event.isText) {
        userMessage = context.trimmedText;
      }

      // 處理圖片輸入（如果有）
      if (context.event.isImage) {
        userMessage = `(使用者上傳圖片，文字說明：「${context.trimmedText || '無'}」)`;
      }

      // 🧠 改成呼叫 Assistant API
      const aiReply = await runAssistant(userMessage);

      // 更新 prompt 與歷史記錄
      prompt.write(ROLE_HUMAN, `${t('__COMPLETION_DEFAULT_AI_TONE')(config.BOT_TONE)}${userMessage}`).write(ROLE_AI, aiReply);
      prompt.patch(aiReply);
      setPrompt(context.userId, prompt);
      updateHistory(context.id, (history) => history.write(config.BOT_NAME, aiReply));

      // 控制是否繼續對話
      const actions = [COMMAND_BOT_CONTINUE];
      context.pushText(aiReply, actions);
    } catch (err) {
      console.error('[Talk Handler Error]', err);
      context.pushText('⚠️ Assistant 暫時無法回覆，請稍後再試。');
    }
    return context;
  }
);

export default { check, exec };

