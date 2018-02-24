const _ = require('lodash');
const { Model } = require('objection');

class Subscription extends Model {
  static get tableName() {
    return 'subscriptions';
  }

  static get fields() {
    return _.keys(this.jsonSchema.properties);
  }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['id', 'expirationDate', 'telegramId'],
      properties: {
        id: {
          type: 'integer'
        },
        expirationDate: {
          type: 'string'
        },
        isActive: {
          type: 'boolean',
          default: false
        },
        paymentInfo: {
          type: 'string'
        }
        telegramId: {
          type: 'integer'
        },
      }
    };
  }

  static get relationMappings() {
    return {
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: `${__dirname}/user.js`,
        join: {
          from: 'subscriptions.userId',
          to: 'users.id'
        }
      }
    };
  }
}

module.exports = User;
