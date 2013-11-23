goog.provide('ptp');
goog.provide('ptp.PtpSession');
goog.provide('ptp.PtpTransport');

goog.require('ptp.Request');
goog.require('ptp.Response');
goog.require('ptp.Unpacker');

var PtpObjectInfo = function(raw) {
  // TODO(nav): There are a bunch of fields here.
  var dataView = new DataView(raw);
  this.StorageId = dataView.getUint32(0, true);
  this.ObjectFormat = dataView.getUint16(4, true);
  this.ProtectionStatus = dataView.getUint16(6, true);
  this.ObjectCompressedSize = dataView.getUint32(8, true);
};

var PtpEvent = function(eventcode, sessionid, transactionid, params) {
  this.eventcode = eventcode;
  this.sessionid = sessionid;
  this.transactionid = transactionid;
  this.params = params;
};

function PtpValues() {
   
}

PtpValues.StandardEvents = {
  OBJECT_ADDED: 0x4002
};

PtpValues.StandardProperties = {
  BATTERY_LEVEL: 0x5001,
  DEVICE_FRIENDLY_NAME: 0xD402
};

PtpValues.StandardOperations = {
  INITIATE_CAPTURE: 0x100e,
  GET_DEVICE_PROP_VALUE: 0x1015,
  EOS_CAPTURE: 0x910F,
  EOS_SET_PC_CONNECT_MODE: 0x9114,
  OPEN_SESSION: 0x1002,
  CLOSE_SESSION: 0x1003,
  GET_OBJECT: 0x1009,
  GET_OBJECT_INFO: 0x1008
};

PtpValues.StandardObjectFormats = {
  EXIF_JPEG: 0x3801
};

PtpValues.StandardResponses = {
  OK: 0x2001,
  DEVICE_PROP_NOT_SUPPORTED: 0x200a
};

ptp.PtpTransport = function(device, descriptor) {
  this.device = device;
  this.sessionid = 0;
  this.bulkin = null;
  this.bulkout = null;
  this.irqin = null;
  for (var i = 0; i < descriptor.endpoints.length; i++) {
    var endpoint = descriptor.endpoints[i];
    if (endpoint.type == 'bulk') {
      if (endpoint.direction == 'in') {
        this.bulkin = endpoint.address;
      } else if (endpoint.direction == 'out') {
        this.bulkout = endpoint.address;
      }
    } else if (endpoint.type == 'interrupt') {
      this.irqin = endpoint.address;
    }
  }
};

ptp.PtpTransport.PTP_USB_CONTAINER_COMMAND = 1;

ptp.PtpTransport.prototype.NewSession = function() {
  this.sessionid += 1;
  return this.sessionid;
};

ptp.PtpTransport.prototype.check_ptp_event = function(sessionid, callback) {
  var transferInfo = {
    direction: 'in',
    endpoint: this.irqin,
    length: 1024 * 1024 * 10
  };
  var transport = this;
  chrome.usb.bulkTransfer(this.device, transferInfo, function(resultInfo) {
    if (resultInfo.resultCode != 0) {
      console.log('BulkTransfer Bad result code: ' + resultInfo.resultCode);
      callback(null);
      return;
    } else {
      var dataView = new DataView(resultInfo.data);
      var dataSize = dataView.getUint32(0, true);
      var containerType = dataView.getUint16(4, true);
      var code = dataView.getUint16(6, true);
      var transactionId = dataView.getUint32(8, true);
      if (containerType != 4) {
        throw "Invalid container type: " + containerType;
      }
      var paramCount = (dataSize -  12) / 4;
      var params = new Array();
      for (var i = 0; i < paramCount; i++) {
        params.push(dataView.getUint32(12 + (i*4), true));
      }
      callback(new PtpEvent(code, sessionid, transactionId, params)); 
      return;
    } 
  });
};

ptp.PtpTransport.prototype.send_ptp_request = function(request, callback) {
  var length = 12 + request.params.length * 4;
  var buffer = new ArrayBuffer(length);
  var dataView = new DataView(buffer);
  dataView.setUint32(0, length, true);
  dataView.setUint16(4, ptp.PtpTransport.PTP_USB_CONTAINER_COMMAND, true);
  dataView.setUint16(6, request.opcode, true);
  dataView.setUint32(8, request.transactionId, true);
  var pos = 12;
  for (var i = 0; i < request.params.length; i++) {
    dataView.setUint32(pos, request.params[i], true);
    pos += 4;
  }

  var transferInfo = {
    direction: 'out',
    endpoint: this.bulkout,
    data: buffer
  };
  console.log('Sending data for ' + request.transactionId);
  chrome.usb.bulkTransfer(this.device, transferInfo, function(resultInfo) {
    console.log('BulkTransfer send result code:' + resultInfo.resultCode);
    callback(resultInfo.resultCode == 0);
  });
};

ptp.PtpTransport.prototype.decode_ptp_response = function(request, buffer) {
  var dataView = new DataView(buffer);
  var dataSize = dataView.getUint32(0, true);
  var containerType = dataView.getUint16(4, true);
  var code = dataView.getUint16(6, true);
  var transactionId = dataView.getUint32(8, true);
  if (transactionId != request.transactionId) {
    console.log('Mismatching transactionId: ' + transactionId + ' -> ' +
      request.transactionId);
    throw "Mismatching transactionId";
  }
  if (containerType != 3) {
    console.log('Wrong container type: ' + containerType);
    throw "Wrong container type: " + containerType;
  }
  // TODO(nav): Read extra params.
  return new ptp.Response(code, request.sessionId, transactionId, null);
};

ptp.PtpTransport.prototype.get_ptp_response = function(request, callback) {
  var transferInfo = {
    direction: 'in',
    endpoint: this.bulkin,
    length: 1024 * 1024 * 10
  };
  var transport = this;
  chrome.usb.bulkTransfer(this.device, transferInfo, function(resultInfo) {
    if (resultInfo.resultCode != 0) {
      console.log('BulkTransfer Bad result code: ' + resultInfo.resultCode);
      callback(null);
      return;
    } else {
      callback(transport.decode_ptp_response(request, resultInfo.data));
      return;
    } 
  });
};

ptp.PtpTransport.prototype.get_ptp_data = function(request, stream, callback) {
  var transferInfo = {
    direction: 'in',
    endpoint: this.bulkin,
    length: 1024 * 1024 * 10
  };
  var transport = this;
  chrome.usb.bulkTransfer(this.device, transferInfo, function(resultInfo) {
    if (resultInfo.resultCode != 0) {
      console.log('Bad result code for bulkTransfer: ' + resultInfo.resultCode);
      callback(null);
      return;
    } else {
      console.log('Status code: ' + resultInfo.resultCode);
      console.log('Data: ' + resultInfo.data.byteLength);
      var dataView = new DataView(resultInfo.data);
      var dataSize = dataView.getUint32(0, true);
      var containerType = dataView.getUint16(4, true);
      var code = dataView.getUint16(6, true);
      var transactionId = dataView.getUint32(8, true);
      console.log('Have response for ' + transactionId);
      console.log('dataSize: ' + dataSize + ' container: ' + containerType +
        ' code: ' + code + ' transid ' + transactionId);
      if (containerType == 3) {
        callback(transport.decode_ptp_response(request, resultInfo.data));
        return;
      } else if (containerType == 2) {
        if (code != request.opcode) {
          throw "Unexpected PTP usb opcode";
        }
        if (transactionId != request.transactionId) {
          throw "Unexpected PTP USB transaction id";
        }
        dataSize -= 12;
        var toread = resultInfo.data.byteLength - 12;
        if (toread > dataSize) {
          toread = dataSize;
        }
        console.log('Returning some raw data: ' + dataSize);
        callback([dataSize, resultInfo.data.slice(12)]);
        return;
      }
      callback(resultInfo.data);
      return;
    }
  });
};

ptp.PtpTransport.prototype.ptp_simple_transaction = function(request, tx_data, receiving, callback) {
  var transport = this;
  this.send_ptp_request(request, function(success) {
    if (!success) {
      callback(null);
      return;
    }

    if (receiving) {
      transport.get_ptp_data(request, null, function(rx_data) {
        var response;
        if (rx_data instanceof ptp.Response) {
          response = rx_data;
          rx_data = null;
        }
        if (response == null) {
          transport.get_ptp_response(request, function(response) {
            callback(response, rx_data);
          });
        } else {
          callback(response, rx_data);
        }
      });
    } else {
      transport.get_ptp_response(request, function(response) {
        callback(response, null);
      });
    }
  });
};

/**
 * @constructor
 */
ptp.PtpSession = function(transport) {
  this.transport = transport;
  this.sessionid = 0;
  this.transactionid = 0;
};

ptp.PtpSession.prototype.OpenSession = function(callback) {
  this.sessionid = this.transport.NewSession();
  this.transactionid = 0;
  var ptpRequest = new ptp.Request(
    PtpValues.StandardOperations.OPEN_SESSION, this.sessionid, this.transactionid,
    [this.sessionid]);
  this.transport.ptp_simple_transaction(ptpRequest, null, false, function(
    ptpResponse, rx) {
    callback(ptpResponse.respcode == PtpValues.StandardResponses.OK);
  });
};

ptp.PtpSession.prototype.NewTransaction = function() {
  this.transactionid += 1;
  return this.transactionid;
};

ptp.PtpSession.prototype.GetObjectInfo = function(objectHandle, callback) {
  var ptpRequest = new ptp.Request(PtpValues.StandardOperations.GET_OBJECT_INFO,
    this.sessionid, this.NewTransaction(), [objectHandle]);
  this.transport.ptp_simple_transaction(ptpRequest, null, true, function(
    ptpResponse, rx_data) {
    if (!ptpResponse) {
      console.log('No PtpResponse Code GetObjectInfo');
      callback(null);
      return;
    }
    if (ptpResponse.respcode != PtpValues.StandardResponses.OK) {
      callback(null);
      return;
    }
    callback(new PtpObjectInfo(rx_data[1]));
  }); 
};

ptp.PtpSession.prototype.GetObject = function(objectHandle, callback) {
  var session = this;
  this.GetObjectInfo(objectHandle, function(objectInfo) {
    if (!objectInfo) {
      callback(null);
      return;
    }
    console.log('About to fetch object of size: ' + objectInfo.ObjectCompressedSize);
    var ptpRequest = new ptp.Request(PtpValues.StandardOperations.GET_OBJECT,
      session.sessionid, session.NewTransaction(), [objectHandle]);
    session.transport.send_ptp_request(ptpRequest, function(result) {
      if (!result) {
        callback(null);
        return;
      }
      session.transport.get_ptp_data(ptpRequest, null, function(rx_data) {
        transport.get_ptp_response(ptpRequest, function(ptpResponse) {
          if (!ptpResponse) {
            console.log('No PtpResponse Code GetObject');
            callback(null);
            return;
          }
          if (ptpResponse.respcode != PtpValues.StandardResponses.OK) {
            callback(null);
            return;
          }
          callback(rx_data[1]);
        });
      });
    });
  });
};

ptp.PtpSession.prototype.CheckForEvent = function(callback) {
  this.transport.check_ptp_event(this.sessionid, callback);
};

ptp.PtpSession.prototype.GetDevicePropValue = function(propertyId, isArray, fmt, callback) {
  var ptpRequest = new ptp.Request(PtpValues.StandardOperations.GET_DEVICE_PROP_VALUE,
    this.sessionid, this.NewTransaction(), [propertyId]);
  this.transport.ptp_simple_transaction(ptpRequest, null, true, function(
    ptp_response, rx) {
    if (ptp_response == null) {
      callback(null);
    } else if (ptp_response.respcode != PtpValues.StandardResponses.OK) {
      callback(null);
    } else {
      var unpacker = new ptp.Unpacker(rx[1]);
      callback(unpacker.unpackSimpletype(isArray, fmt));
    }
  });
};

ptp.PtpSession.prototype.GetBatteryLevel = function(callback) {
  this.GetDevicePropValue(
    PtpValues.StandardProperties.BATTERY_LEVEL, false, 'B', callback);
};

ptp.PtpSession.prototype.GetDeviceFriendlyName = function(callback) {
  this.GetDevicePropValue(
    PtpValues.StandardProperties.DEVICE_FRIENDLY_NAME, false, '_STR',
    callback);
};

ptp.PtpSession.prototype.Capture = function(callback) {
  var ptpRequest = new ptp.Request(PtpValues.StandardOperations.EOS_CAPTURE,
    this.sessionid, this.NewTransaction(), []);
  var session = this;
  this.transport.ptp_simple_transaction(ptpRequest, null, false, function(
    ptpResponse, tx) {
    if (!ptpResponse) {
      console.log('No PTPResponse');
      callback(null);
      return;
    }
    console.log('RespCode for Capture:' + ptpResponse.respcode);
    if (ptpResponse.respcode != PtpValues.StandardResponses.OK) {
      callback(null);
      return;
    }
    session.CheckForEvent(function(ptpEvent) {
      if (ptpEvent.eventcode == PtpValues.StandardEvents.OBJECT_ADDED) {
        console.log('Event::Object added');
        var objectId = ptpEvent.params[0];
        session.GetObject(objectId, callback);
      } else {
        callback(null);
      }
    });
   });
};

ptp.PtpSession.prototype.SetPCConnectMode = function(callback) {
  var ptpRequest = new ptp.Request(PtpValues.StandardOperations.EOS_SET_PC_CONNECT_MODE,
    this.sessionid, this.NewTransaction(), []);
  var session = this;
  this.transport.ptp_simple_transaction(ptpRequest, null, false, function(
    ptpResponse, tx) {
    console.log('RespCode for PC Connect:' + ptpResponse.respcode);
    if (ptpResponse.respcode != PtpValues.StandardResponses.OK) {
      callback(null);
      return;
    }
    callback(true);
   });
};

goog.exportSymbol('ptp.PtpSession');
goog.exportSymbol('ptp.PtpTransport');

