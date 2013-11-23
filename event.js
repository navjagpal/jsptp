/**
 * @fileoverview Event
 */

goog.provide('ptp.Event');

/**
 * Represents a PTP Event.
 * @param {Number} eventcode PTP event code.
 * @param {Number} sessionid Session id.
 * @param {Number} transactionid Transacation id.
 * @param {Array.<Object>} params Params associated with the event.
<<<<<<< HEAD
 * @constructor
=======
>>>>>>> f1d1217677957a400b2480df057d49899a97d2b2
 */
ptp.Event = function(eventcode, sessionid, transactionid, params) {
  this.eventcode = eventcode;
  this.sessionid = sessionid;
  this.transactionid = transactionid;
  this.params = params;
};

goog.exportSymbol('ptp.Event');
