const _ = require('lodash');
const { transaction } = require('objection');
const User = require('../../models/user');
const Transaction = require('../../models/transaction');

const respondToAuth = (content, bot) => {
  const userAttributes = {
    telegramId: content.payload.userId
  };
  User.findOrCreate(userAttributes)
  .then()
  .catch(console.warn);
};

const respondToGrant = (content, bot) => {
  const userAttributes = {
    chtwrsId: content.payload.id,
    chtwrsToken: content.payload.token
  };
  User.query()
  .patch(userAttributes)
  .where('telegramId', content.payload.userId)
  .then(() => {
    const respondToGrantMessage = JSON.stringify({
      chat_id: content.payload.userId,
      text: 'Great! That seemed to have worked! You have been authenticated and are ready to go!'
    });
    return bot.sendTelegramMessage('sendMessage', respondToGrantMessage);
  })
  .catch(console.warn);
};

const requestConfirmationText = `Great! Please confirm the deposit \
using the confirmation code from @chtwrsbot.

To confirm, please do:
/confirm [confirmation code from @chtwrsbot]`;

const contactDeveloperText = `Sorry! There seems to be a problem \
with your request. Please try again with a new deposit/withdraw request. \
If you believe that this message was sent in error, please contact @knightniwrem instead.`;

const respondToAuthorizePayment = (content, bot) => {
  const transactionId = content.payload.transactionId;
  const hasSuccessfulResult = content.result.toLowerCase() === 'ok';

  const depositTransaction = transaction(bot.knex, async (transactionObject) => {
    const transaction = await Transaction.query(transactionObject).where('id', transactionId).first();
    const user = await User.query(transactionObject).where('id', transaction.toId).first();

    const status = hasSuccessfulResult ? 'pending' : 'cancelled';
    await transaction.$query(transactionObject).patch({
      apiStatus: content.result,
      status: status
    });

    const text = hasSuccessfulResult ? requestConfirmationText : contactDeveloperText;
    const message = JSON.stringify({
      chat_id: user.telegramId,
      text: text
    });
    return bot.sendTelegramMessage('sendMessage', message);
  });

  return Promise.resolve(depositTransaction);
};

const respondToPay = (content, bot) => {
  const transactionId = content.payload.transactionId;
  const hasSuccessfulResult = content.result.toLowerCase() === 'ok';

  const depositTransaction = transaction(bot.knex, async (transactionObject) => {
    const transaction = await Transaction.query(transactionObject).where('id', transactionId).first();
    const user = await User.query(transactionObject).where('id', transaction.toId).first();

    let finalBalance = user.balance;
    if (hasSuccessfulResult) {
      finalBalance = user.balance + content.payload.debit.gold;
      await user.$query(transactionObject).patch({ 
        balance: finalBalance 
      });
    }

    const status = hasSuccessfulResult ? 'completed' : 'cancelled';
    await transaction.$query(transactionObject).patch({
      apiStatus: content.result,
      status: status
    });

    const text = hasSuccessfulResult ? `Your deposit request is successful! Your new balance is ${finalBalance} gold.` : contactDeveloperText;
    const message = JSON.stringify({
      chat_id: user.telegramId,
      text: text
    });
    return bot.sendTelegramMessage('sendMessage', message);
  });

  return Promise.resolve(depositTransaction);
};

const respondToPayout = (content, bot) => {
  const transactionId = content.payload.transactionId;
  const hasSuccessfulResult = content.result.toLowerCase() === 'ok';

  const withdrawalTransaction = transaction(bot.knex, async (transactionObject) => {
    const attributes = {
      apiStatus: content.result,
      status: hasSuccessfulResult ? 'completed' : 'cancelled'
    };
    const transaction = await Transaction.query(transactionObject).where('id', transactionId).first().patch(attributes).returning('*');
    const user = await User.query(transactionObject).where('id', transaction.fromId).first();

    if (!hasSuccessfulResult) {
      await user.$query(transactionObject).patch({ 
        balance: user.balance + content.payload.debit.gold 
      });
    }

    const text = hasSuccessfulResult ? `Your withdrawal request is successful! Your new balance is ${user.balance} gold.` : contactDeveloperText;
    const message = JSON.stringify({
      chat_id: user.telegramId,
      text: text
    });
    return bot.sendTelegramMessage('sendMessage', message);
  });

  return Promise.resolve(withdrawalTransaction);
};

const respondToGetInfo = (content, bot) => {
  const message = JSON.stringify({
    chat_id: 41284431,
    text: `${JSON.stringify(content)}`
  });
  return bot.sendTelegramMessage('sendMessage', message);
};

const respondToUnknown = (content) => {
  console.warn(`Inbound queue: ${content.action} returned status code ${content.result}`);
};

const inboundResponders = {
  authorizePayment: respondToAuthorizePayment,
  createAuthCode: respondToAuth,
  getInfo: respondToGetInfo,
  grantToken: respondToGrant,
  pay: respondToPay,
  payout: respondToPayout
};

const inboundErrorResponders = {
  authorizePayment: respondToAuthorizePayment,
  pay: respondToPay,
  payout: respondToPayout
};

const inbound = (params) => {
  if (_.isNil(params.bot)) {
    console.warn('Inbound queue: Bot cannot be missing');
    return;
  }

  const bot = params.bot;
  const content = JSON.parse(params.rawMessage.content.toString());
  if (_.isEmpty(content.action) && !_.isEmpty(content.payload.operation)) {
    content.action = 'authAdditionalOperation';
  }

  const responderMap = content.result.toLowerCase() === 'ok' ? inboundResponders : inboundErrorResponders;
  const action = content.action;
  const responder = responderMap[action];
  const usableResponder = !_.isNil(responder) ? responder : respondToUnknown;
  usableResponder(content, bot);
};

module.exports = inbound;
