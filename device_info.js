goog.provide('ptp.DeviceInfo');
goog.provide('ptp.DevicePropertyInfo');
goog.provide('ptp.EOSDeviceInfo');
goog.require('ptp.Unpacker');

/**
 * Encapsulates DeviceInfo data.
 * @param {ArrayBuffer} buffer
 */
ptp.DeviceInfo = function(buffer) {
  var unpacker = new ptp.Unpacker(buffer);
  this.standardVersion = unpacker.unpackSimpletype(false, 'H');
  this.vendorExtensionId = unpacker.unpackSimpletype(false, 'I');
  this.venderExtensionVersion = unpacker.unpackSimpletype(false, 'H');
  this.vendorExtensionDesc = unpacker.unpackSimpletype(false, '_STR');
  this.functionalMode = unpacker.unpackSimpletype(false, 'H');
  this.operationsSupported = unpacker.unpackArray('H');
  this.eventsSupported = unpacker.unpackArray('H');
  this.devicePropertiesSupported = unpacker.unpackArray('H');
};

/**
 * Returns a new array of hex numbers from the input array.
 * @param {Array.<number>} buf
 * @return {Array.<string>}
 * @private
 */
ptp.DeviceInfo.prototype.toHexArray_ = function(buf) {
 var hexops = [];
 for (var i = 0; i < buf.length; i++) {
   hexops.push(buf[i].toString(16));
 }
 return hexops;
};

/**
 * Returns a string representation of the data.
 * @return {string}
 */
ptp.DeviceInfo.prototype.toString = function() {
  return 'Props: ' + this.toHexArray_(
    this.devicePropertiesSupported).join('\n');
};

ptp.EOSDeviceInfo = function(buffer) {
  var unpacker = new ptp.Unpacker(buffer);
  // Ignore first 4 bytes.
  var ignored = unpacker.unpackSimpletype(false, 'I');
  this.eventsSupported = unpacker.unpackArray('I');
  this.devicePropertiesSupported = unpacker.unpackArray('I');
};

/**
 * Returns a new array of hex numbers from the input array.
 * @param {Array.<number>} buf
 * @return {Array.<string>}
 * @private
 */
ptp.EOSDeviceInfo.prototype.toHexArray_ = function(buf) {
 var hexops = [];
 for (var i = 0; i < buf.length; i++) {
   hexops.push(buf[i].toString(16));
 }
 return hexops;
};

/**
 * Returns a string representation of the data.
 * @return {string}
 */
ptp.EOSDeviceInfo.prototype.toString = function() {
  return 'Props: ' + this.toHexArray_(
    this.devicePropertiesSupported).join('\n');
};

ptp.DevicePropertyInfo = function(buffer) {
  var unpacker = new ptp.Unpacker(buffer);
  this.propertyCode = unpacker.unpackSimpletype(false, 'H');
  this.dataType = unpacker.unpackSimpletype(false, 'H');
  this.dataType = unpacker.unpackSimpletype(false, 'B');
};
