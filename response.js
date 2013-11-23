/**
 * @fileoverview Response implementation.
 */

goog.provide('ptp.Response');

/**
 * Represents a PTP Response message.
 * @param {Number} respcode PTP response code.
 * @param {Number} sessionId Session id.
 * @param {Number} transactionId Transaction id.
 * @param {Array.<Object>} params Params returned as part of the response.
 * @constructor
 */
ptp.Response = function(respcode, sessionId, transactionId, params) {
  this.respcode = respcode;
  this.sessionId = sessionId;
  this.transactionId = transactionId;
  this.params = params;
};

goog.exportSymbol('ptp.Response');
