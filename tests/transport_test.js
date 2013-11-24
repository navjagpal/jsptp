goog.require('ptp.Event');
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
}

var getEvent = function(eventId, transactionId) {
  var buffer = new ArrayBuffer(12);
  var dataView = new DataView(buffer);
  dataView.setUint32(0, 12, true);
  dataView.setUint16(4, ptp.Transport.USB_CONTAINER_EVENT, true);
  dataView.setUint16(6, eventId, true);
  dataView.setUint32(8, transactionId, true);
  return buffer;
}

var testCheckEvent = function() {
  var eventId = 20;
  var transactionId = 40;
  chrome.usb.bulkTransfer = goog.testing.createFunctionMock();
  var ignored = new goog.testing.mockmatchers.IgnoreArgument();
  chrome.usb.bulkTransfer(ignored, ignored,
    goog.testing.mockmatchers.isFunction).$does(function(
    device, transaction, callback) {
    callback({resultCode: 0, data: getEvent(eventId, transactionId)});
  });
  chrome.usb.bulkTransfer.$replay();
  var result = undefined;
  transport.CheckEvent(0, function(returned) {
    result = returned;
  });
  chrome.usb.bulkTransfer.$verify();
  goog.asserts.assertInstanceof(result, ptp.Event);
  assertEquals(result.eventcode, eventId);
  assertEquals(result.transactionid, transactionId);
  goog.asserts.assertArray(result.params, []);
}

/**
 * Tests a problem with the underlying read. We expect a null value to be
 * returned.
 */
var testCheckEventBadRead = function() {
  chrome.usb.bulkTransfer = goog.testing.createFunctionMock();
  var ignored = new goog.testing.mockmatchers.IgnoreArgument();
  chrome.usb.bulkTransfer(ignored, ignored,
    goog.testing.mockmatchers.isFunction).$does(function(
    device, transaction, callback) {
    callback({resultCode: 1});
  });
  chrome.usb.bulkTransfer.$replay();
  var result = undefined;
  transport.CheckEvent(0, function(returned) {
    result = returned;
  });
  chrome.usb.bulkTransfer.$verify();
  assertNull(result);
}
