/**
 * @fileoverview Request implementation.
 */

goog.provide('ptp.Request');

/**
 * Represents a PTP Request message.
 * @param {Number} opcode The operation code.
 * @param {Number} sessionId The session id.
 * @param {Number} transactionId The transaction id.
 * @param {Array.<Object>} params Params to be included as part of the request.
 * @constructor
 */
ptp.Request = function(opcode, sessionId, transactionId, params) {
  this.opcode = opcode;
  this.sessionid = sessionId;
  this.transactionid = transactionId;
  this.params = params;
};

goog.exportSymbol('ptp.Request');
