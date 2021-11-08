/* eslint-disable class-methods-use-this, global-require, no-underscore-dangle */
const debug = require('debug')(require('path').basename(__filename, '.js'));

class OffnetTestReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
  }

  onRunComplete(contexts, results) {
    debug('Sending Offnet Test output to Slack...');

    try {
      const { IncomingWebhook } = require('@slack/webhook');

      const url =
        'https://hooks.slack.com/services/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';
      const webhook = new IncomingWebhook(url);

      (async () => {
        const message = {
          startTime: new Date(results.startTime),
          totalTests: results.numTotalTests,
          totalPassed: results.numPassedTests,
          totalFailed: results.numFailedTests,
        };

        await webhook.send({
          text: `Offnet Test Reporter\n${JSON.stringify(message, 0, 2)}`,
        });
      })();

      debug('Test Results sent!!!');
    } catch (error) {
      debug('onRunComplete Test Reporter ERROR: ', error);
    }
  }
}
module.exports = OffnetTestReporter;
