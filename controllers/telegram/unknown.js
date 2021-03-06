const _ = require('lodash');
const Promise = require('bluebird');

const makeUnknownMessage = (chatId) => {
  const unknownText = `Sorry, I couldn't quite understand that.`;
  const unknownMessage = JSON.stringify({
    chat_id: chatId,
    text: unknownText
  });
  return unknownMessage;
};

const unknown = (params) => {
  if (_.isNil(params.bot)) {
    return Promise.reject('Rejected in unknown: Bot cannot be missing');
  }
  if (_.isNil(params.chatId)) {
    return Promise.reject('Rejected in unknown: Missing telegram chat id');
  }

  const bot = params.bot;
  const chatId = params.chatId;
  const unknownMessage = makeUnknownMessage(chatId);
  return bot.sendTelegramMessage('sendMessage', unknownMessage);  
};

module.exports = unknown;
