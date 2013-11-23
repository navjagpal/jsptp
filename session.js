/**
 * Represents a Session. This is agnostic of the underlying
 * transport mechanism aside from assuming an async API.
 */

goog.provide('ptp');
goog.provide('ptp.Session');

goog.require('ptp.Event');
goog.require('ptp.ObjectInfo');
goog.require('ptp.Request');
goog.require('ptp.Response');
goog.require('ptp.Transport');
goog.require('ptp.Unpacker');
goog.require('ptp.Values');

/**
 * Creates a new Session.
 * @param {Transport} transport Underlying transport mechanism.
 * @constructor
 */
ptp.Session = function(transport) {
  /**
   * Transport mechanism, probably something like a USB transport layer.
   * @type {Transport}
   * @private
   */
  this.transport_ = transport;

  /**
   * The current session id.
   * @type {number}
   * @private
   */
  this.sessionid_ = 0;

  /**
   * The current transaction id.
   * @type {number}
   * @private
   */
  this.transactionid_ = 0;
};

/**
 * Opens a new Session with the device.
 * @param {function(boolean)} callback
 */
ptp.Session.prototype.OpenSession = function(callback) {
  this.sessionid_ = this.transport_.NewSession();
  this.transactionid_ = 0;
  var ptpRequest = new ptp.Request(
    ptp.Values.StandardOperations.OPEN_SESSION, this.sessionid_,
    this.transactionid_, [this.sessionid_]);
  this.transport_.SimpleTransaction(ptpRequest, false, function(
    ptpResponse, rx) {
    callback(ptpResponse &&
             ptpResponse.respcode == ptp.Values.StandardResponses.OK);
  });
};

/**
 * Returns a new transaction id.
 * @return {number} New transaction id.
 */
ptp.Session.prototype.NewTransaction = function() {
  this.transactionid_ += 1;
  return this.transactionid_;
};

/**
 * Gets the ObjectInfo associated with the provided object.
 * @param {number} objectId
 * @param {function(ObjectInfo)} callback
 */
ptp.Session.prototype.GetObjectInfo = function(objectId, callback) {
  var ptpRequest = new ptp.Request(
    ptp.Values.StandardOperations.GET_OBJECT_INFO,
    this.sessionid_, this.NewTransaction(), [objectId]);
  this.transport_.SimpleTransaction(ptpRequest, true, function(
    ptpResponse, rx_data) {
    if (!ptpResponse) {
      console.log('No PtpResponse Code GetObjectInfo');
      callback(null);
    } else if (ptpResponse.respcode != ptp.Values.StandardResponses.OK) {
      callback(null);
    } else {
      callback(new ptp.ObjectInfo(rx_data[1]));
    }
  });
};

/**
 * Gets the Object associated with the provided object id.
 * @param {number} objectId
 * @param {function(ArrayBuffer)} callback
 */
ptp.Session.prototype.GetObject = function(objectId, callback) {
  var session = this;
  this.GetObjectInfo(objectId, function(objectInfo) {
    if (!objectInfo) {
      callback(null);
      return;
    }
    var ptpRequest = new ptp.Request(ptp.Values.StandardOperations.GET_OBJECT,
      session.sessionid_, session.NewTransaction(), [objectId]);
    session.transport_.SendRequest(ptpRequest, function(result) {
      if (!result) {
        callback(null);
        return;
      }
      session.transport_.GetData(ptpRequest, function(rx_data) {
        transport.GetResponse(ptpRequest, function(ptpResponse) {
          if (!ptpResponse) {
            console.log('No PtpResponse Code GetObject');
            callback(null);
          } else if (ptpResponse.respcode != ptp.Values.StandardResponses.OK) {
            callback(null);
          } else {
            callback(rx_data[1]);
          }
        });
      });
    });
  });
};

/**
 * Reads and returns an Event object.
 * @param {function(Event)} callback
 */
ptp.Session.prototype.CheckForEvent = function(callback) {
  this.transport_.CheckEvent(this.sessionid_, callback);
};

/**
 * Reads and returns the value associated with the device property.
 * @param {number} propertyId
 * @param {boolean} isArray
 * @param {string} fmt Format string
 * @param {function(object)} callback
 */
ptp.Session.prototype.GetDevicePropValue = function(
  propertyId, isArray, fmt, callback) {
  var ptpRequest = new ptp.Request(
    ptp.Values.StandardOperations.GET_DEVICE_PROP_VALUE,
    this.sessionid_, this.NewTransaction(), [propertyId]);
  this.transport_.SimpleTransaction(ptpRequest, true, function(
    ptp_response, rx) {
    if (ptp_response == null) {
      callback(null);
    } else if (ptp_response.respcode != ptp.Values.StandardResponses.OK) {
      callback(null);
    } else {
      var unpacker = new ptp.Unpacker(rx[1]);
      callback(unpacker.unpackSimpletype(isArray, fmt));
    }
  });
};

/**
 * Returns the device friendly name.
 * @param {function(string)} callback
 */
ptp.Session.prototype.GetDeviceFriendlyName = function(callback) {
  this.GetDevicePropValue(
    ptp.Values.StandardProperties.DEVICE_FRIENDLY_NAME, false, '_STR',
    callback);
};

/**
 * Initiates a Capture on the device and returns the image data.
 * @param {function(ArrayBuffer)} callback
 */
ptp.Session.prototype.Capture = function(callback) {
  var ptpRequest = new ptp.Request(
    ptp.Values.StandardOperations.EOS_CAPTURE,
    this.sessionid_, this.NewTransaction(), []);
  var session = this;
  this.transport_.SimpleTransaction(ptpRequest, false, function(
    ptpResponse, tx) {
    if (!ptpResponse) {
      console.log('No PTPResponse');
      callback(null);
    } else {
      console.log('RespCode for Capture:' + ptpResponse.respcode);
      if (ptpResponse.respcode != ptp.Values.StandardResponses.OK) {
        callback(null);
      } else {
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
    }
   });
};

ptp.Session.prototype.LiveView = function(callback) {
  var ptpRequest = new ptp.Request(0x9153,
    this.sessionid_, this.NewTransaction(), []);
  var session = this;
  this.transport_.SimpleTransaction(ptpRequest, true, function(
    ptpResponse, tx) {
    if (!ptpResponse) {
      console.log('No PTPResponse');
      callback(null);
      return;
    }
    console.log('ptpResponse: ' + ptpResponse);
    console.log('tx: ' + tx);
    callback(null);
  });
};

/**
 * Sets up the device for PC Connect Mode.
 * @param {function(boolean)} callback
 */
ptp.Session.prototype.SetPCConnectMode = function(callback) {
  var ptpRequest = new ptp.Request(
    ptp.Values.StandardOperations.EOS_SET_PC_CONNECT_MODE,
    this.sessionid_, this.NewTransaction(), []);
  this.transport_.SimpleTransaction(ptpRequest, false, function(
    ptpResponse, tx) {
    console.log('RespCode for PC Connect:' + ptpResponse.respcode);
    callback(ptpResponse.respcode == ptp.Values.StandardResponses.OK);
   });
};

goog.exportSymbol('ptp.Session');
