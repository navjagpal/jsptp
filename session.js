/**
 * Represents a Session. This is agnostic of the underlying
 * transport mechanism aside from assuming an async API.
 */

goog.provide('ptp');
goog.provide('ptp.Session');

goog.require('ptp.Event');
goog.require('ptp.Request');
goog.require('ptp.Response');
goog.require('ptp.Transport');
goog.require('ptp.ObjectInfo');
goog.require('ptp.Values');
goog.require('ptp.Unpacker');

/**
 * @constructor
 */
ptp.Session = function(transport) {
  this.transport = transport;
  this.sessionid = 0;
  this.transactionid = 0;
};

ptp.Session.prototype.OpenSession = function(callback) {
  this.sessionid = this.transport.NewSession();
  this.transactionid = 0;
  var ptpRequest = new ptp.Request(
    ptp.Values.StandardOperations.OPEN_SESSION, this.sessionid, this.transactionid,
    [this.sessionid]);
  this.transport.SimpleTransaction(ptpRequest, null, false, function(
    ptpResponse, rx) {
    callback(ptpResponse.respcode == ptp.Values.StandardResponses.OK);
  });
};

ptp.Session.prototype.NewTransaction = function() {
  this.transactionid += 1;
  return this.transactionid;
};

ptp.Session.prototype.GetObjectInfo = function(objectHandle, callback) {
  var ptpRequest = new ptp.Request(ptp.Values.StandardOperations.GET_OBJECT_INFO,
    this.sessionid, this.NewTransaction(), [objectHandle]);
  this.transport.SimpleTransaction(ptpRequest, null, true, function(
    ptpResponse, rx_data) {
    if (!ptpResponse) {
      console.log('No PtpResponse Code GetObjectInfo');
      callback(null);
      return;
    }
    if (ptpResponse.respcode != ptp.Values.StandardResponses.OK) {
      callback(null);
      return;
    }
    callback(new ptp.ObjectInfo(rx_data[1]));
  }); 
};

ptp.Session.prototype.GetObject = function(objectHandle, callback) {
  var session = this;
  this.GetObjectInfo(objectHandle, function(objectInfo) {
    if (!objectInfo) {
      callback(null);
      return;
    }
    console.log('About to fetch object of size: ' + objectInfo.ObjectCompressedSize);
    var ptpRequest = new ptp.Request(ptp.Values.StandardOperations.GET_OBJECT,
      session.sessionid, session.NewTransaction(), [objectHandle]);
    session.transport.send_ptp_request(ptpRequest, function(result) {
      if (!result) {
        callback(null);
        return;
      }
      session.transport.GetPtpData(ptpRequest, null, function(rx_data) {
        transport.GetPtpResponse(ptpRequest, function(ptpResponse) {
          if (!ptpResponse) {
            console.log('No PtpResponse Code GetObject');
            callback(null);
            return;
          }
          if (ptpResponse.respcode != ptp.Values.StandardResponses.OK) {
            callback(null);
            return;
          }
          callback(rx_data[1]);
        });
      });
    });
  });
};

ptp.Session.prototype.CheckForEvent = function(callback) {
  this.transport.check_ptp_event(this.sessionid, callback);
};

ptp.Session.prototype.GetDevicePropValue = function(propertyId, isArray, fmt, callback) {
  var ptpRequest = new ptp.Request(ptp.Values.StandardOperations.GET_DEVICE_PROP_VALUE,
    this.sessionid, this.NewTransaction(), [propertyId]);
  this.transport.SimpleTransaction(ptpRequest, null, true, function(
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

ptp.Session.prototype.GetBatteryLevel = function(callback) {
  this.GetDevicePropValue(
    ptp.Values.StandardProperties.BATTERY_LEVEL, false, 'B', callback);
};

ptp.Session.prototype.GetDeviceFriendlyName = function(callback) {
  this.GetDevicePropValue(
    ptp.Values.StandardProperties.DEVICE_FRIENDLY_NAME, false, '_STR',
    callback);
};

ptp.Session.prototype.Capture = function(callback) {
  var ptpRequest = new ptp.Request(ptp.Values.StandardOperations.EOS_CAPTURE,
    this.sessionid, this.NewTransaction(), []);
  var session = this;
  this.transport.SimpleTransaction(ptpRequest, null, false, function(
    ptpResponse, tx) {
    if (!ptpResponse) {
      console.log('No PTPResponse');
      callback(null);
      return;
    }
    console.log('RespCode for Capture:' + ptpResponse.respcode);
    if (ptpResponse.respcode != ptp.Values.StandardResponses.OK) {
      callback(null);
      return;
    }
    session.CheckForEvent(function(ptpEvent) {
      if (ptpEvent.eventcode == ptp.Values.StandardEvents.OBJECT_ADDED) {
        console.log('Event::Object added');
        var objectId = ptpEvent.params[0];
        session.GetObject(objectId, callback);
      } else {
        callback(null);
      }
    });
   });
};

ptp.Session.prototype.SetPCConnectMode = function(callback) {
  var ptpRequest = new ptp.Request(ptp.Values.StandardOperations.EOS_SET_PC_CONNECT_MODE,
    this.sessionid, this.NewTransaction(), []);
  var session = this;
  this.transport.SimpleTransaction(ptpRequest, null, false, function(
    ptpResponse, tx) {
    console.log('RespCode for PC Connect:' + ptpResponse.respcode);
    if (ptpResponse.respcode != ptp.Values.StandardResponses.OK) {
      callback(null);
      return;
    }
    callback(true);
   });
};

goog.exportSymbol('ptp.Session');
