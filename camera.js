/**
 * @fileoverview Convenience classes for performing common operations
 * with common cameras.
 */

goog.provide('ptp.Camera');
goog.provide('ptp.CanonCamera');
goog.require('ptp.Request');
goog.require('ptp.Values');

/**
 * Performs common camera operations.
 * @param {ptp.Session} session
 * @constructor
 */
ptp.Camera = function(session) {
  /**
   * Underlying PTP session.
   * @type {ptp.Session}
   * @private
   */
  this.session_ = session;
};


/**
 * Initiates a Capture on the device and returns the image data.
 * @param {function(ArrayBuffer)} callback
 */
ptp.Camera.prototype.Capture = function(callback) {
};

/**
 * Represents a Canon EOS DSLR camera.
 * @param {ptp.Session} session
 * @constructor
 */
ptp.CanonCamera = function(session) {
  ptp.Camera.call(this, session);
};
goog.inherits(ptp.CanonCamera, ptp.Camera);


/**
 * Initiates a Capture on the device and returns the image data.
 * @param {function(ArrayBuffer)} callback
 */
ptp.CanonCamera.prototype.Capture = function(callback) {
  var ptpRequest = new ptp.Request(
    ptp.Values.EOSOperations.CAPTURE,
    this.session_.getSessionId(), this.session_.NewTransaction(), []);
  var session = this.session_;
  session.transport.SimpleTransaction(ptpRequest, {receiving: false},
    function(ptpResponse, tx) {
    if (ptpResponse == null) {
      console.log('No PTPResponse');
      callback(null);
    } else if (ptpResponse.respcode != ptp.Values.StandardResponses.OK) {
      callback(null);
    } else {
      console.log('RespCode for Capture:' + ptpResponse.respcode);
      console.log('About to wait or event');
      session.CheckForEvent(function(ptpEvent) {
        if (ptpEvent.eventcode == ptp.Values.StandardEvents.OBJECT_ADDED) {
          console.log('Event::Object added');
          var objectId = ptpEvent.params[0];
          session.GetObject(objectId, callback);
        } else {
          callback(null);
        }
      });
    }
   });
};

goog.exportSymbol('ptp.Camera');
goog.exportSymbol('ptp.CanonCamera');
