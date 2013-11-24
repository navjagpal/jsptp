/**
 * @fileoverview Classes related to unpacking byte data.
 */

goog.provide('ptp.Unpacker');

/**
 * Unpacks raw byte data from responses into the appropriate JS data types.
 * @param {ArrayBuffer} buffer The raw byte data to unpack.
 * @constructor
 */
ptp.Unpacker = function(buffer) {
  /**
   * Raw byte array.
   * @type ArrayBuffer
   * @private
   */
  this.buffer_ = buffer;

  /**
   * Current position within the buffer.
   * @type Number
   * @private
   */
  this.offset_ = 0;

  console.log('Buffer size: ' + buffer.byteLength);
};

/**
 * Unpacks a String from the current offset.
 * @return {String} The unpacked string.
 * @private
 */
ptp.Unpacker.prototype.unpackString_ = function() {
  var dataView = new DataView(this.buffer_);
  var strLen = dataView.getInt8(this.offset_, true);
  this.offset_ += 1;

  var s = String.fromCharCode.apply(null,
    new Uint16Array(this.buffer_.slice(
      this.offset_, this.offset_ + strLen * 2)));
  this.offset_ += strLen * 2;
  return s;
};

ptp.Unpacker.prototype.unpackUint32_ = function() {
  var dataView = new DataView(this.buffer_);
  var value = dataView.getUint32(this.offset_, true);
  this.offset_ += 4;
  return value;
};

ptp.Unpacker.prototype.unpackUint16_ = function() {
  var dataView = new DataView(this.buffer_);
  var value = dataView.getUint16(this.offset_, true);
  this.offset_ += 2;
  return value;
};


ptp.Unpacker.prototype.unpackArray = function(fmt) {
  var dataView = new DataView(this.buffer_);
  var arrayCount = dataView.getUint32(this.offset_, true);
  console.log('Array count: ' + arrayCount);
  this.offset_ += 4;
  
  var outputBuffer = new Array();
  for (var i = 0; i < arrayCount; i++) {
    if (fmt == 'H') {
      outputBuffer.push(this.unpackUint16_());
    } else if (fmt == 'I') {
      outputBuffer.push(this.unpackUint32_());
    }
  }
  return outputBuffer;
};

/**
 * Convenience method to unpack common types using format strings.
 * @param {bool} isArray Whether or not the return value is an array.
 * @param {String} fmt Format string describing the data to unpack.
 * @return {Object} The unpacked data.
 */
ptp.Unpacker.prototype.unpackSimpletype = function(
  isArray, fmt) {
  if (!isArray) {
    if (fmt == 'H') {
      return this.unpackUint16_();
    } else if (fmt == 'I') {
      return this.unpackUint32_();
    } else if (fmt == '_STR') {
      return this.unpackString_();
    }
  }
};

goog.exportSymbol('ptp.Unpacker');
