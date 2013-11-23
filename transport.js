/**
 * Transport layer.
 */

goog.provide('ptp.Transport');

goog.require('ptp.Event');
goog.require('ptp.Response');
goog.require('ptp.Values');

/**
 * Represents the PTP transport over chrome.USB.
 * @param {!Object} device chrome.usb device handle. This must already
 *   be connected and authorized.
 * @param {!Object} descriptor Device descriptor; describes endpoints.
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

/**
 * Command container type.
 * @const
 * @type {number}
 */
ptp.Transport.USB_CONTAINER_COMMAND = 1;

/**
 * Data container type.
 * @const
 * @type {number}
 */
ptp.Transport.USB_CONTAINER_DATA = 2;

/**
 * Response container type.
 * @const
 * @type {number}
 */
ptp.Transport.USB_CONTAINER_RESPONSE = 3;

/**
 * Event container type.
 * @const
 * @type {number}
 */
ptp.Transport.USB_CONTAINER_EVENT = 4;

/**
 * Creates and returns a new PTP Session id.
 * @return {number} New session id.
 */
ptp.Transport.prototype.NewSession = function() {
  this.sessionid += 1;
  return this.sessionid;
};

/**
 * Reads and returns an Event from the input stream.
 * @param {number} sessionId The session id.
 * @param {function(ptp.Event)} callback Will be called with event.
 */
ptp.Transport.prototype.CheckEvent = function(sessionId, callback) {
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
      if (containerType != ptp.Transport.USB_CONTAINER_EVENT) {
        throw 'Invalid container type: ' + containerType;
      }
      var paramCount = (dataSize - 12) / 4;
      var params = new Array();
      for (var i = 0; i < paramCount; i++) {
        params.push(dataView.getUint32(12 + (i * 4), true));
      }
      callback(new ptp.Event(code, sessionId, transactionId, params));
      return;
    }
  });
};

/**
 * Sends a Request to the device.
 * @param {Request} request Request to send.
 * @param {function(boolean)} callback Called with success value.
 *  If false, there was a problem writing the request.
 */
ptp.Transport.prototype.SendRequest = function(request, callback) {
  var length = 12 + request.params.length * 4;
  var buffer = new ArrayBuffer(length);
  var dataView = new DataView(buffer);
  dataView.setUint32(0, length, true);
  dataView.setUint16(4, ptp.Transport.USB_CONTAINER_COMMAND, true);
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

/**
 * Decodes and returns a Response from the supplied buffer.
 * @param {Request} request Request object, used to match the response
 *  transaction id.
 * @param {ArrayBuffer} buffer Buffer that contains Response.
 * @return {Response} Response Response message, or null if there was a
 *  problem reading the response. This could be due to mismatching
 *  transaction id, invalid buffer size, etc.
 */
// TODO(nav): Provide a way to return more error-related information.
ptp.Transport.prototype.DecodeResponse = function(request, buffer) {
  var dataView = new DataView(buffer);
  var dataSize = dataView.getUint32(0, true);
  var containerType = dataView.getUint16(4, true);
  var code = dataView.getUint16(6, true);
  var transactionId = dataView.getUint32(8, true);
  if (transactionId != request.transactionId) {
    console.log('Mismatching transactionId: ' + transactionId + ' -> ' +
      request.transactionId);
    return null;
  }
  if (containerType != ptp.Transport.USB_CONTAINER_RESPONSE) {
    console.log('Wrong container type: ' + containerType);
    return null;
  }
  // TODO(nav): Read extra params.
  return new ptp.Response(code, request.sessionId, transactionId, null);
};

/**
 * Reads a Response from the input stream that corresponds to the supplied
 * Request.
 * @param {Request} request
 * @param {function(Response)} callback
 */
ptp.Transport.prototype.GetResponse = function(request, callback) {
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
      callback(transport.DecodeResponse(request, resultInfo.data));
      return;
    }
  });
};

/**
 * Reads and returns Response or raw data from the stream.
 * @param {Request} request
 * @param {function(Response|ArrayBuffer)} callback
 */
ptp.Transport.prototype.GetData = function(request, callback) {
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
      if (containerType == ptp.Transport.USB_CONTAINER_RESPONSE) {
        callback(transport.DecodeResponse(request, resultInfo.data));
      } else if (containerType == ptp.Transport.USB_CONTAINER_DATA) {
        if (code != request.opcode) {
          throw 'Unexpected PTP usb opcode';
        }
        if (transactionId != request.transactionId) {
          throw 'Unexpected PTP USB transaction id';
        }
        dataSize -= 12;
        var toread = resultInfo.data.byteLength - 12;
        if (toread > dataSize) {
          toread = dataSize;
        }
        console.log('Returning some raw data: ' + dataSize);
        callback([dataSize, resultInfo.data.slice(12)]);
      } else {
        callback(resultInfo.data);
      }
    }
  });
};

/**
 * Performs a simple and common Transaction.
 * @param {Request} request
 * @param {boolean} receiving Whether or not we expect to receive data as
 *  part of the Response. If so, the data will be supplied in the callback.
 * @param {function(Response, ArrayBuffer)} callback
 */
ptp.Transport.prototype.SimpleTransaction = function(
  request, receiving, callback) {
  var transport = this;
  this.SendRequest(request, function(success) {
    if (!success) {
      callback(null);
      return;
    }

    if (receiving) {
      transport.GetData(request, function(rx_data) {
        var response;
        if (rx_data instanceof ptp.Response) {
          response = rx_data;
          rx_data = null;
        }
        if (response == null) {
          transport.GetResponse(request, function(response) {
            callback(response, rx_data);
          });
        } else {
          callback(response, rx_data);
        }
      });
    } else {
      transport.GetResponse(request, function(response) {
        callback(response, null);
      });
    }
  });
};

goog.exportSymbol('ptp.Transport');

