/**
 * Transport layer.
 */

goog.provide('ptp.Transport');

goog.require('ptp.Event');
goog.require('ptp.Request');
goog.require('ptp.Response');
goog.require('ptp.ObjectInfo');
goog.require('ptp.Values');
goog.require('ptp.Unpacker');

/**
 * Represents the PTP transport over chrome.USB.
 * @param {Object} device chrome.usb device handle. This must already be connected
 *  and authorized.
 * @param {Object} descriptor Device descriptor; describes endpoints.
 * @constructor
 */
ptp.Transport = function(device, descriptor) {
  this.sessionid = 0;
  /**
   * Device handle.
   * @type Object
   * @private
   */
  this.device_ = device;

  /**
   * Address of the bulkin endpoint.
   * @type Number
   * @private
   */
  this.bulkin_ = null;

  /**
   * Address of the bulkout endpoint.
   * @type Number
   * @private
   */
  this.bulkout_ = null;

  /**
   * Address of the irq endpoint.
   * @type Number
   * @private
   */
  this.irqin_ = null;
  for (var i = 0; i < descriptor.endpoints.length; i++) {
    var endpoint = descriptor.endpoints[i];
    if (endpoint.type == 'bulk') {
      if (endpoint.direction == 'in') {
        this.bulkin_ = endpoint.address;
      } else if (endpoint.direction == 'out') {
        this.bulkout_ = endpoint.address;
      }
    } else if (endpoint.type == 'interrupt') {
      this.irqin_ = endpoint.address;
    }
  }
};

ptp.Transport.PTP_USB_CONTAINER_COMMAND = 1;

/**
 * Creates and returns a new PTP Session id.
 * @return {Number} New session id.
 */
ptp.Transport.prototype.NewSession = function() {
  this.sessionid += 1;
  return this.sessionid;
};

ptp.Transport.prototype.check_ptp_event = function(sessionid, callback) {
  var transferInfo = {
    direction: 'in',
    endpoint: this.irqin_,
    length: 1024 * 1024 * 10
  };
  var transport = this;
  chrome.usb.bulkTransfer(this.device_, transferInfo, function(resultInfo) {
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
      callback(new ptp.Event(code, sessionid, transactionId, params)); 
      return;
    } 
  });
};

ptp.Transport.prototype.send_ptp_request = function(request, callback) {
  var length = 12 + request.params.length * 4;
  var buffer = new ArrayBuffer(length);
  var dataView = new DataView(buffer);
  dataView.setUint32(0, length, true);
  dataView.setUint16(4, ptp.Transport.PTP_USB_CONTAINER_COMMAND, true);
  dataView.setUint16(6, request.opcode, true);
  dataView.setUint32(8, request.transactionId, true);
  var pos = 12;
  for (var i = 0; i < request.params.length; i++) {
    dataView.setUint32(pos, request.params[i], true);
    pos += 4;
  }

  var transferInfo = {
    direction: 'out',
    endpoint: this.bulkout_,
    data: buffer
  };
  console.log('Sending data for ' + request.transactionId);
  chrome.usb.bulkTransfer(this.device_, transferInfo, function(resultInfo) {
    console.log('BulkTransfer send result code:' + resultInfo.resultCode);
    callback(resultInfo.resultCode == 0);
  });
};

ptp.Transport.prototype.decode_ptp_response = function(request, buffer) {
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

ptp.Transport.prototype.get_ptp_response = function(request, callback) {
  var transferInfo = {
    direction: 'in',
    endpoint: this.bulkin_,
    length: 1024 * 1024 * 10
  };
  var transport = this;
  chrome.usb.bulkTransfer(this.device_, transferInfo, function(resultInfo) {
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

ptp.Transport.prototype.get_ptp_data = function(request, stream, callback) {
  var transferInfo = {
    direction: 'in',
    endpoint: this.bulkin_,
    length: 1024 * 1024 * 10
  };
  var transport = this;
  chrome.usb.bulkTransfer(this.device_, transferInfo, function(resultInfo) {
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

ptp.Transport.prototype.ptp_simple_transaction = function(request, tx_data, receiving, callback) {
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

goog.exportSymbol('ptp.Transport');

