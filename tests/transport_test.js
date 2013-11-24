goog.require('ptp.Event');
goog.require('ptp.Request');
goog.require('ptp.Transport');

goog.require('goog.asserts');
goog.require('goog.testing.FunctionMock');
goog.require('goog.testing.Mock');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers');

var bulkTransfer = function(device, transferInfo, callback) {
};

var chrome = {usb: {}};

var transport;

function setUp() {
  var deviceHandle = {};
  var descriptor = {endpoints: []};
  transport = new ptp.Transport(deviceHandle, descriptor);
}

var testNewSession = function() {
  assertEquals(1, transport.NewSession()); 
  assertEquals(2, transport.NewSession());
  assertEquals(3, transport.NewSession());
}

var testCheckEventError = function() {
  chrome.usb.bulkTransfer = goog.testing.createFunctionMock();
  var ignored = new goog.testing.mockmatchers.IgnoreArgument();
  chrome.usb.bulkTransfer(ignored, ignored,
    goog.testing.mockmatchers.isFunction).$does(function(
    d, t, c) {
    c({resultCode: 1});
  });
  chrome.usb.bulkTransfer.$replay();
  var result = undefined;
  transport.CheckEvent(0, function(returned) {
    result = returned;
  });
  assertNull(result);
  chrome.usb.bulkTransfer.$verify();
};

var getEvent = function(eventId, transactionId, params) {
  var buffer = new ArrayBuffer(12 + params.length * 4);
  var dataView = new DataView(buffer);
  dataView.setUint32(0, 12 + params.length * 4, true);
  dataView.setUint16(4, ptp.Transport.USB_CONTAINER_EVENT, true);
  dataView.setUint16(6, eventId, true);
  dataView.setUint32(8, transactionId, true);
  for (var i = 0; i < params.length; i++) {
    dataView.setUint32(12 + (i * 4), params[i]);
  } 
  return buffer;
};

var getResponse = function(opcode, transactionId, params) {
  var buffer = new ArrayBuffer(12 + params.length * 4);
  var dataView = new DataView(buffer);
  dataView.setUint32(0, 12 + params.length * 4, true);
  dataView.setUint16(4, ptp.Transport.USB_CONTAINER_RESPONSE, true);
  dataView.setUint16(6, opcode, true);
  dataView.setUint32(8, transactionId, true);
  for (var i = 0; i < params.length; i++) {
    dataView.setUint32(12 + (i * 4), params[i]);
  } 
  return buffer;
};

var testCheckEvent = function() {
  var eventId = 20;
  var transactionId = 40;
  var params = [100, 200];
  chrome.usb.bulkTransfer = goog.testing.createFunctionMock();
  var ignored = new goog.testing.mockmatchers.IgnoreArgument();
  chrome.usb.bulkTransfer(ignored, ignored,
    goog.testing.mockmatchers.isFunction).$does(function(
    device, transaction, callback) {
    callback({resultCode: 0, data: getEvent(eventId, transactionId, params)});
  });
  chrome.usb.bulkTransfer.$replay();
  var result = undefined;
  transport.CheckEvent(0, function(returned) {
    result = returned;
  });
  chrome.usb.bulkTransfer.$verify();
  goog.asserts.assertInstanceof(result, ptp.Event);
  assertEquals(eventId, result.eventcode);
  assertEquals(transactionId, result.transactionid);
  goog.asserts.assertArray(params, result.params);
}

var testSendRequestError = function() {
  var request = new ptp.Request(1, 2, 3, []);
  chrome.usb.bulkTransfer = goog.testing.createFunctionMock();
  var ignored = new goog.testing.mockmatchers.IgnoreArgument();
  chrome.usb.bulkTransfer(ignored, ignored,
    goog.testing.mockmatchers.isFunction).$does(function(
    device, transferInfo, callback) {
    savedBuffer = transferInfo.data;
    callback({resultCode: 1});
  });
  chrome.usb.bulkTransfer.$replay();
  var result = undefined;
  transport.SendRequest(request, function(returned) {
    result = returned;
  });
  chrome.usb.bulkTransfer.$verify();
  assertFalse(result);
  // Verify the correct buffer was sent, even though there was an error
  // in the send.
  var dataView = new DataView(savedBuffer);
  assertEquals(savedBuffer.byteLength, 12 );
  assertEquals(dataView.getUint32(0, true), savedBuffer.byteLength);
  assertEquals(dataView.getUint16(4, true), ptp.Transport.USB_CONTAINER_COMMAND);
  assertEquals(dataView.getUint16(6, true), 1);
  assertEquals(dataView.getUint32(8, true), 3);
}

var testSendRequest = function() {
  var opcode = 100;
  var sessionId = 200;
  var transactionId = 300;
  var params = [1, 2];
  var request = new ptp.Request(opcode, sessionId, transactionId, params);
  chrome.usb.bulkTransfer = goog.testing.createFunctionMock();
  var ignored = new goog.testing.mockmatchers.IgnoreArgument();
  var savedBuffer = null;
  chrome.usb.bulkTransfer(ignored, ignored,
    goog.testing.mockmatchers.isFunction).$does(function(
    device, transferInfo, callback) {
    savedBuffer = transferInfo.data;
    callback({resultCode: 0});
  });
  chrome.usb.bulkTransfer.$replay();
  var result = undefined;
  transport.SendRequest(request, function(returned) {
    result = returned;
  });
  chrome.usb.bulkTransfer.$verify();
  assertTrue(result);
  // Verify the correct buffer was sent.
  var dataView = new DataView(savedBuffer);
  assertEquals(12 + params.length * 4, savedBuffer.byteLength);
  assertEquals(savedBuffer.byteLength, dataView.getUint32(0, true));
  assertEquals(ptp.Transport.USB_CONTAINER_COMMAND, dataView.getUint16(4, true));
  assertEquals(opcode, dataView.getUint16(6, true));
  assertEquals(transactionId, dataView.getUint32(8, true));
  for (var i = 0; i < params.length; i++) {
    assertEquals(params[i], dataView.getUint32(12 + (i * 4), true));
  }
}

var testDecodeResponse = function() {
  var opcode = 50;
  var sessionId = 100;
  var transactionId = 200;
  var params = [1, 2, 3, 4, 5];
  var request = new ptp.Request(1, sessionId, transactionId, []);
  var rawResponse = getResponse(opcode, transactionId, params)
  var response = transport.DecodeResponse(request, rawResponse);
  assertEquals(opcode, response.respcode);
  assertEquals(sessionId, response.sessionId);
  assertEquals(transactionId, response.transactionId);
  goog.asserts.assertArray(params, response.params);
}
