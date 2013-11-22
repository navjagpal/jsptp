/**
 * @fileoverview Request implementation.
 */

goog.provide('ptp.Request');

ptp.Request = function(opcode, sessionid, transactionid, params) {
  this.opcode = opcode;
  this.sessionid = sessionid;
  this.transactionid = transactionid;
  this.params = params;
};

ptp.Request.prototype.ToString = function() {
  return 'blah';
};
