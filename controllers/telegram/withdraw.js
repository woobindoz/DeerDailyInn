const _ = require('lodash');
const Promise = require('bluebird');
const { transaction } = require('objection');
const User = require('../../models/user');
const Transaction = require('../../models/transaction');

const makeUnregisteredMessage = (chatId) => {
  const text = `Hi, you don't seem to \
be registered yet! Do /start to register first!`;
  
  const message = JSON.stringify({
    chat_id: chatId,
    text: text
  });
  return message;
};

const makeBadArgumentMessage = (chatId) => {
  const text = `You need to specify a valid amount of gold \
pouches that you would like to withdraw!`;

  const message = JSON.stringify({
    chat_id: chatId,
    text: text
  });
  return message;
};

const makeInsufficientBalanceMessage = (chatId, amount, balance) => {
  const text = `Sorry! You don't have sufficient funds to \
withdraw ${amount} gold pouches! Your current \
balance is ${balance} gold.`;

  const message = JSON.stringify({
    chat_id: chatId,
    text: text
  });
  return message;
};

const makePayoutRequest = (chtwrsToken, amount, transactionId) => {
  const message = JSON.stringify({
    action: 'payout',
    payLoad: {
      amount: {
        pouches: amount
      },
      message: `You have withdrawn ${amount} gold pouch(es)!`,
      transactionId: `${transactionId}`
    },
    token: chtwrsToken
  });
  return message;
};

const withdraw = async (params) => {
  if (_.isNil(params.bot)) {
    return Promise.reject('Rejected in withdraw: Bot cannot be missing');
  }
  if (_.isNil(params.telegramId) || _.isNil(params.chatId)) {
    return Promise.reject('Rejected in withdraw: Missing telegram user id or chat id');
  }

  const bot = params.bot;
  const chatId = params.chatId;
  const telegramId = params.telegramId;
  let withdrawalAmount = parseInt(params.options[0]);
  if (!_.isInteger(withdrawalAmount) || withdrawalAmount < 1) {
    const message = makeBadArgumentMessage(chatId);
    return bot.sendTelegramMessage('sendMessage', message);
  }

  const withdrawTransaction = transaction(bot.knex, async (transactionObject) => {
    const user = await User.query(transactionObject).where('telegramId', telegramId).first();
    if (_.isNil(user) || _.isEmpty(user.chtwrsToken)) {
      const message = makeUnregisteredMessage(chatId);
      bot.sendTelegramMessage('sendMessage', message);
      return Promise.reject(`Rejected in withdraw: User ${telegramId} is not registered.`);
    }

    const amountInGold = withdrawalAmount * 100;
    if (user.balance < amountInGold) {
      const message = makeInsufficientBalanceMessage(chatId, withdrawalAmount, user.balance);
      bot.sendTelegramMessage('sendMessage', message);
      return Promise.reject(`Rejected in withdraw: User ${user.telegramId} tried to withdraw ${amountInGold} gold but only had ${user.balance} gold in balance.`);
    }

    const userAttributes = {
      balance: user.balance - amountInGold
    };
    const updatedUser = await user.$query(transactionObject).patch(userAttributes).returning('*');

    const transactionAttributes = {
      fromId: user.id,
      quantity: amountInGold,
      reason: 'User invoked /withdraw command',
      status: 'pending',
      toId: 0
    };
    const recordedTransaction = await Transaction.create(transactionAttributes, transactionObject);
    return Promise.all([updatedUser, recordedTransaction]);
  });

  return Promise.resolve(withdrawTransaction)
  .then(([user, transaction]) => {
    const request = makePayoutRequest(user.chtwrsToken, withdrawalAmount, transaction.id);
    return bot.sendChtwrsMessage(request);
  });
};

module.exports = withdraw;
