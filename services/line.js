import config from '../../config/index.js';
import { t } from '../../locales/index.js';
import config from '../config/index.js';
import { COMMAND_BOT_CONTINUE, COMMAND_BOT_FORGET, COMMAND_BOT_TALK } from '../commands/index.js';
import Context from '../context.js';
import { updateHistory } from '../history/index.js';
import { getPrompt, setPrompt } from '../prompt/index.js';
import { runAssistant } from '../../services/openai.js'; // ✅ 新增這行

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

