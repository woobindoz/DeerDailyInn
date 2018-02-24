const _ = require('lodash');

const startController = require('./telegram/start');
const authController = require('./telegram/auth');
const defaultController = require('./telegram/unknown');

const controllerRouter = {
  start: startController,
  auth: authController,
};

const telegramRouter = (params) => {
  const controllerName = params.isCommand ? params.controllerName.slice(1) : params.controllerName;
  const controller = controllerRouter[controllerName];
  const usableController = !_.isNil(controller) ? controller : defaultController;
  return usableController(params);
};

module.exports = telegramRouter;